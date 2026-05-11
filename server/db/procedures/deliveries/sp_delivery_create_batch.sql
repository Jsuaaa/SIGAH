-- Batch delivery creation (#24 CA4).
--
-- Takes the top p_count eligible families (via fn_prioritization_next_batch),
-- finds the nearest warehouse with stock for each one, and calls
-- sp_delivery_create for each. Families that fail (not eligible, no stock,
-- etc.) are collected in "skipped" instead of aborting the batch.
--
-- TODO: refinar paquete según política operativa — por ahora usa el primer
-- resource_type FOOD activo con stock suficiente para la ración de 7 días.
--
-- Inputs:
--   p_count      : how many families to process (1–100).
--   p_user_id    : user triggering the batch (delivered_by for each delivery).
--   p_ip         : reserved for audit (#47).
--   p_user_agent : reserved for audit (#47).
--
-- Returns: TABLE(created INT, skipped INT, skipped_families JSONB).

CREATE OR REPLACE FUNCTION sp_delivery_create_batch(
    p_count      INTEGER,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS TABLE (created INT, skipped INT, skipped_families JSONB)
LANGUAGE plpgsql AS $$
DECLARE
    v_created          INT     := 0;
    v_skipped          INT     := 0;
    v_skipped_list     JSONB   := '[]'::JSONB;

    v_family           JSONB;
    v_family_id        INTEGER;
    v_family_lat       DOUBLE PRECISION;
    v_family_lng       DOUBLE PRECISION;

    v_warehouse_row    JSONB;
    v_warehouse_id     INTEGER;

    v_resource_id      INTEGER;
    v_min_food_kg      DOUBLE PRECISION;
    v_unit_weight      DOUBLE PRECISION;
    v_qty_needed       INTEGER;
    v_avail_qty        INTEGER;

    v_coverage_days    INTEGER := 7;
    v_request          JSONB;
    v_details          JSONB;

    v_err_msg          TEXT;
BEGIN
    PERFORM p_ip;
    PERFORM p_user_agent;

    IF p_count IS NULL OR p_count < 1 OR p_count > 100 THEN
        RAISE EXCEPTION 'p_count must be between 1 and 100' USING ERRCODE = 'SH422';
    END IF;

    -- Iterate over the top-N eligible families.
    FOR v_family IN
        SELECT data FROM fn_prioritization_next_batch(p_count)
    LOOP
        v_family_id  := (v_family ->> 'id')::INTEGER;
        v_family_lat := (v_family ->> 'latitude')::DOUBLE PRECISION;
        v_family_lng := (v_family ->> 'longitude')::DOUBLE PRECISION;

        -- Find nearest warehouse with stock.
        SELECT data
          INTO v_warehouse_row
          FROM fn_warehouses_nearest(
              COALESCE(v_family_lat, 0),
              COALESCE(v_family_lng, 0),
              1
          )
         LIMIT 1;

        IF v_warehouse_row IS NULL THEN
            v_skipped      := v_skipped + 1;
            v_skipped_list := v_skipped_list || jsonb_build_array(
                jsonb_build_object('family_id', v_family_id, 'reason', 'No warehouse with stock found')
            );
            CONTINUE;
        END IF;

        v_warehouse_id := (v_warehouse_row ->> 'id')::INTEGER;

        -- Compute minimum food kg for 7-day coverage.
        v_min_food_kg := fn_delivery_min_food_kg(v_family_id, v_coverage_days);

        -- Pick the first active FOOD resource type with sufficient stock in the warehouse.
        -- TODO: refinar paquete según política operativa.
        SELECT rt.id, rt.unit_weight_kg,
               COALESCE(SUM(i.available_quantity), 0)::INTEGER
          INTO v_resource_id, v_unit_weight, v_avail_qty
          FROM resource_types rt
          JOIN inventory i ON i.resource_type_id = rt.id
                           AND i.warehouse_id = v_warehouse_id
                           AND i.available_quantity > 0
         WHERE rt.category = 'FOOD'
           AND rt.is_active = TRUE
         GROUP BY rt.id, rt.unit_weight_kg
        HAVING rt.unit_weight_kg > 0
           AND COALESCE(SUM(i.available_quantity), 0) * rt.unit_weight_kg >= v_min_food_kg
         ORDER BY rt.id ASC
         LIMIT 1;

        IF NOT FOUND THEN
            v_skipped      := v_skipped + 1;
            v_skipped_list := v_skipped_list || jsonb_build_array(
                jsonb_build_object(
                    'family_id', v_family_id,
                    'reason',    'Insufficient FOOD stock for minimum ration'
                )
            );
            CONTINUE;
        END IF;

        -- Compute quantity needed to meet the minimum ration (round up).
        v_qty_needed := CEIL(v_min_food_kg / v_unit_weight)::INTEGER;

        v_request := jsonb_build_object(
            'family_id',            v_family_id,
            'source_warehouse_id',  v_warehouse_id,
            'coverage_days',        v_coverage_days
        );
        v_details := jsonb_build_array(
            jsonb_build_object(
                'resource_type_id', v_resource_id,
                'quantity',         v_qty_needed
            )
        );

        BEGIN
            PERFORM sp_delivery_create(v_request, v_details, p_user_id, p_ip, p_user_agent);
            v_created := v_created + 1;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
            v_skipped      := v_skipped + 1;
            v_skipped_list := v_skipped_list || jsonb_build_array(
                jsonb_build_object('family_id', v_family_id, 'reason', v_err_msg)
            );
        END;
    END LOOP;

    RETURN QUERY SELECT v_created, v_skipped, v_skipped_list;
END $$;
