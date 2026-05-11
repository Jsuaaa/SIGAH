-- sp_distribution_plans_execute (Issue #46, HU-21 CA execute)
--
-- Materializa las entregas de un plan PROGRAMADA o EN_EJECUCION:
--   1. Verifica que el plan exista y sea ejecutable (SH404/SH422).
--   2. Transiciona plan a EN_EJECUCION.
--   3. Por cada item PENDIENTE:
--       a. Calcula la cantidad de FOOD necesaria para cumplir min_food_kg.
--       b. Llama sp_delivery_create con plan_item_id inyectado en p_request.
--       c. Si OK: item → ENTREGADO, delivery_id asignado.
--       d. Si excepción: item → SIN_ATENDER, reason = mensaje de error.
--   4. Si todos los items están resueltos (ENTREGADO|SIN_ATENDER) → COMPLETADA.
--
-- Inputs:
--   p_plan_id    : id del plan.
--   p_user_id    : usuario ejecutor.
--   p_ip         : reservado para audit (#47).
--   p_user_agent : reservado para audit (#47).

CREATE OR REPLACE FUNCTION sp_distribution_plans_execute(
    p_plan_id    INTEGER,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS distribution_plans
LANGUAGE plpgsql AS $$
DECLARE
    v_plan         distribution_plans;
    v_item         distribution_plan_items;
    v_delivery     deliveries;
    v_resource_id  INTEGER;
    v_unit_weight  DOUBLE PRECISION;
    v_min_food_kg  DOUBLE PRECISION;
    v_quantity     INTEGER;
    v_request      JSONB;
    v_details      JSONB;
    v_pending      BIGINT;
BEGIN
    SELECT * INTO v_plan FROM distribution_plans WHERE id = p_plan_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Distribution plan not found' USING ERRCODE = 'SH404';
    END IF;

    IF v_plan.status NOT IN ('PROGRAMADA', 'EN_EJECUCION') THEN
        RAISE EXCEPTION 'Cannot execute a plan in status %', v_plan.status
            USING ERRCODE = 'SH422';
    END IF;

    -- Transicionar a EN_EJECUCION.
    UPDATE distribution_plans
       SET status = 'EN_EJECUCION'
     WHERE id = p_plan_id
    RETURNING * INTO v_plan;

    -- Procesar cada item PENDIENTE.
    FOR v_item IN
        SELECT *
          FROM distribution_plan_items
         WHERE plan_id = p_plan_id
           AND status  = 'PENDIENTE'
         ORDER BY priority_score_snapshot DESC
         FOR UPDATE
    LOOP
        BEGIN
            -- Calcula mínimo de kg de comida requerido.
            v_min_food_kg := fn_delivery_min_food_kg(v_item.family_id, v_item.target_coverage_days);

            -- Elige el primer resource_type FOOD con stock suficiente en la bodega asignada.
            SELECT rt.id, rt.unit_weight_kg
              INTO v_resource_id, v_unit_weight
              FROM inventory i
              JOIN resource_types rt ON rt.id = i.resource_type_id
             WHERE i.warehouse_id      = v_item.source_warehouse_id
               AND rt.category         = 'FOOD'
               AND rt.is_active        = TRUE
               AND i.available_quantity > 0
             ORDER BY i.expiration_date NULLS LAST, rt.id ASC
             LIMIT 1;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No FOOD resource available in warehouse %', v_item.source_warehouse_id
                    USING ERRCODE = 'SH422';
            END IF;

            -- Calcula unidades necesarias para cubrir min_food_kg.
            v_quantity := CEIL(v_min_food_kg / v_unit_weight)::INTEGER;

            -- Construye el request JSONB con plan_item_id para sp_delivery_create.
            v_request := jsonb_build_object(
                'family_id',           v_item.family_id,
                'source_warehouse_id', v_item.source_warehouse_id,
                'coverage_days',       v_item.target_coverage_days,
                'plan_item_id',        v_item.id
            );

            v_details := jsonb_build_array(
                jsonb_build_object(
                    'resource_type_id', v_resource_id,
                    'quantity',         v_quantity
                )
            );

            -- Crea la entrega (sp_delivery_create valida elegibilidad + stock).
            SELECT * INTO v_delivery
              FROM sp_delivery_create(v_request, v_details, p_user_id, p_ip, p_user_agent);

            -- Actualiza item a ENTREGADO.
            UPDATE distribution_plan_items
               SET status      = 'ENTREGADO',
                   delivery_id = v_delivery.id
             WHERE id = v_item.id;

        EXCEPTION WHEN OTHERS THEN
            -- Error esperado o inesperado: marcar SIN_ATENDER sin abortar el plan.
            UPDATE distribution_plan_items
               SET status = 'SIN_ATENDER',
                   reason = SQLERRM
             WHERE id = v_item.id;
        END;
    END LOOP;

    -- Si no quedan items PENDIENTE, el plan está COMPLETADA.
    SELECT COUNT(*) INTO v_pending
      FROM distribution_plan_items
     WHERE plan_id = p_plan_id
       AND status  = 'PENDIENTE';

    IF v_pending = 0 THEN
        UPDATE distribution_plans
           SET status = 'COMPLETADA'
         WHERE id = p_plan_id
        RETURNING * INTO v_plan;
    ELSE
        SELECT * INTO v_plan FROM distribution_plans WHERE id = p_plan_id;
    END IF;

    -- Auditoría: EXECUTE DistributionPlan (Issue #47)
    PERFORM sp_audit_insert(
        'EXECUTE',
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
