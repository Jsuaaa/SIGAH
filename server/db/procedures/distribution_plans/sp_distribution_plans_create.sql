-- sp_distribution_plans_create (Issue #46, HU-21)
--
-- Genera un plan de distribución priorizado:
--   1. Genera plan_code = fn_next_code('PLN').
--   2. INSERT distribution_plans con status='PROGRAMADA'.
--   3. Selecciona familias elegibles según scope (GLOBAL/ZONA/REFUGIO/LOTE).
--   4. Ordena por priority_score DESC.
--   5. Por cada familia:
--       a. Verifica elegibilidad (fn_delivery_check_eligibility).
--       b. Calcula bodega más cercana con stock FOOD suficiente.
--       c. INSERT plan_item PENDIENTE o SIN_ATENDER.
--   6. Retorna la fila distribution_plans.
--
-- Inputs:
--   p_request    : JSONB {
--       scope              TEXT,           -- GLOBAL|ZONA|REFUGIO|LOTE
--       scope_id           INTEGER?,       -- zone_id o shelter_id
--       target_coverage_days INTEGER,      -- >= 3
--       notes              TEXT?,
--       family_ids         JSONB?          -- array de ids si scope=LOTE
--   }
--   p_user_id    : id del usuario que crea el plan.
--   p_ip         : reservado para audit (#47).
--   p_user_agent : reservado para audit (#47).

CREATE OR REPLACE FUNCTION sp_distribution_plans_create(
    p_request    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS distribution_plans
LANGUAGE plpgsql AS $$
DECLARE
    v_scope         distribution_plan_scope := (p_request ->> 'scope')::distribution_plan_scope;
    v_scope_id      INTEGER                 := NULLIF(p_request ->> 'scope_id', '')::INTEGER;
    v_coverage_days INTEGER                 := (p_request ->> 'target_coverage_days')::INTEGER;
    v_notes         TEXT                    := NULLIF(p_request ->> 'notes', '');
    v_family_ids    JSONB                   := p_request -> 'family_ids';  -- array para LOTE

    v_plan_code     TEXT;
    v_plan          distribution_plans;
    v_family        RECORD;
    v_eligibility   RECORD;
    v_min_food_kg   DOUBLE PRECISION;
    v_warehouse_id  INTEGER;
    v_wh_row        RECORD;
    v_item_status   distribution_plan_item_status;
    v_reason        TEXT;
    v_stock_ok      BOOLEAN;
BEGIN
    -- p_ip y p_user_agent usados en auditoría al final del SP (Issue #47).

    -- Validaciones básicas de forma (las de negocio viven aquí, en el SP).
    IF v_coverage_days IS NULL OR v_coverage_days < 3 THEN
        RAISE EXCEPTION 'target_coverage_days must be >= 3 (RN-01)'
            USING ERRCODE = 'SH422';
    END IF;
    IF v_scope IS NULL THEN
        RAISE EXCEPTION 'scope is required'
            USING ERRCODE = 'SH422';
    END IF;
    IF v_scope = 'LOTE' AND (v_family_ids IS NULL OR jsonb_array_length(v_family_ids) = 0) THEN
        RAISE EXCEPTION 'family_ids is required when scope = LOTE'
            USING ERRCODE = 'SH422';
    END IF;
    IF v_scope IN ('ZONA', 'REFUGIO') AND v_scope_id IS NULL THEN
        RAISE EXCEPTION 'scope_id is required for scope %', v_scope
            USING ERRCODE = 'SH422';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    -- 1. Generar código y crear plan.
    v_plan_code := fn_next_code('PLN');

    INSERT INTO distribution_plans (plan_code, created_by, status, scope, scope_id, notes)
    VALUES (v_plan_code, p_user_id, 'PROGRAMADA', v_scope, v_scope_id, v_notes)
    RETURNING * INTO v_plan;

    -- 2. Seleccionar familias según scope, ordenadas por priority_score DESC.
    FOR v_family IN
        SELECT f.id,
               f.family_code,
               f.priority_score,
               f.num_members,
               f.latitude,
               f.longitude,
               f.zone_id,
               f.shelter_id
          FROM families f
         WHERE f.status IN ('ACTIVO', 'EN_REFUGIO')
           AND (
               v_scope = 'GLOBAL'
               OR (v_scope = 'ZONA'    AND f.zone_id    = v_scope_id)
               OR (v_scope = 'REFUGIO' AND f.shelter_id = v_scope_id)
               OR (v_scope = 'LOTE'    AND f.id = ANY(
                       SELECT (elem ->> 0)::INTEGER
                         FROM jsonb_array_elements_text(v_family_ids) AS elem
                   ))
           )
         ORDER BY f.priority_score DESC
    LOOP
        v_item_status  := 'PENDIENTE';
        v_reason       := NULL;
        v_warehouse_id := NULL;

        -- a. Elegibilidad.
        BEGIN
            SELECT * INTO v_eligibility
              FROM fn_delivery_check_eligibility(v_family.id);
        EXCEPTION WHEN OTHERS THEN
            v_item_status := 'SIN_ATENDER';
            v_reason      := 'INELIGIBLE: ' || SQLERRM;
        END;

        IF v_item_status = 'PENDIENTE' AND NOT v_eligibility.is_eligible THEN
            v_item_status := 'SIN_ATENDER';
            v_reason      := 'INELIGIBLE: ' || COALESCE(v_eligibility.reason, 'COVERED');
        END IF;

        -- b. Si es elegible, busca bodega más cercana con stock FOOD suficiente.
        IF v_item_status = 'PENDIENTE' THEN
            v_min_food_kg := fn_delivery_min_food_kg(v_family.id, v_coverage_days);
            v_stock_ok    := FALSE;

            -- Obtiene bodegas ordenadas por distancia. Si la familia no tiene
            -- coordenadas usa la primera bodega ACTIVE disponible.
            IF v_family.latitude IS NOT NULL AND v_family.longitude IS NOT NULL THEN
                FOR v_wh_row IN
                    SELECT (d.data ->> 'id')::INTEGER AS wh_id
                      FROM fn_warehouses_nearest(v_family.latitude, v_family.longitude, 10) AS d
                LOOP
                    -- Verifica stock FOOD suficiente en esa bodega.
                    IF (
                        SELECT COALESCE(SUM(i.available_quantity * rt.unit_weight_kg), 0)
                          FROM inventory i
                          JOIN resource_types rt ON rt.id = i.resource_type_id
                         WHERE i.warehouse_id     = v_wh_row.wh_id
                           AND rt.category        = 'FOOD'
                           AND i.available_quantity > 0
                    ) >= v_min_food_kg THEN
                        v_warehouse_id := v_wh_row.wh_id;
                        v_stock_ok     := TRUE;
                        EXIT;
                    END IF;
                END LOOP;
            ELSE
                -- Sin coordenadas: primera bodega ACTIVE con stock FOOD suficiente.
                SELECT w.id INTO v_warehouse_id
                  FROM warehouses w
                 WHERE w.status = 'ACTIVE'
                   AND (
                       SELECT COALESCE(SUM(i.available_quantity * rt.unit_weight_kg), 0)
                         FROM inventory i
                         JOIN resource_types rt ON rt.id = i.resource_type_id
                        WHERE i.warehouse_id     = w.id
                          AND rt.category        = 'FOOD'
                          AND i.available_quantity > 0
                   ) >= v_min_food_kg
                 ORDER BY w.id ASC
                 LIMIT 1;

                IF v_warehouse_id IS NOT NULL THEN
                    v_stock_ok := TRUE;
                END IF;
            END IF;

            IF NOT v_stock_ok THEN
                v_item_status  := 'SIN_ATENDER';
                v_reason       := 'INSUFFICIENT_STOCK';
                v_warehouse_id := NULL;
            END IF;
        END IF;

        -- c. INSERT plan_item.
        INSERT INTO distribution_plan_items (
            plan_id,
            family_id,
            source_warehouse_id,
            target_coverage_days,
            priority_score_snapshot,
            status,
            reason
        )
        VALUES (
            v_plan.id,
            v_family.id,
            v_warehouse_id,
            v_coverage_days,
            v_family.priority_score,
            v_item_status,
            v_reason
        );
    END LOOP;

    -- Auditoría: CREATE DistributionPlan (Issue #47)
    PERFORM sp_audit_insert(
        'CREATE',
        'distribution_plans',
        'DistributionPlan',
        v_plan.id,
        p_user_id,
        NULL,
        to_jsonb(v_plan),
        p_ip,
        p_user_agent
    );

    RETURN v_plan;
END $$;
