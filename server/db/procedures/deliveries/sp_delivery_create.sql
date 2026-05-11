-- Regular (non-exception) delivery creation (HU-23, #24 CA1/CA2/CA3/CA5).
--
-- Identical flow to sp_delivery_create_exception, but:
--   1. Verifies eligibility via fn_delivery_check_eligibility BEFORE creating
--      anything (RN-02) — raises SH409 when not eligible.
--   2. Does NOT accept exception_reason / exception_authorized_by.
--   3. After creation calls sp_priority_recalc (RN-08).
--
-- Single transaction:
--   1. Eligibility check (SH409 if not eligible).
--   2. Validate family + warehouse exist.
--   3. Validate coverage_days >= 3 (RN-01).
--   4. Idempotency shortcut via client_op_id.
--   5. Compute minimum food kg via fn_delivery_min_food_kg.
--   6. Generate ENT-YYYY-NNNNN and INSERT deliveries.
--   7. For each detail: consume inventory (SH422 on shortage) + INSERT detail.
--   8. Verify total food weight >= min_food_kg (RN-01).
--   9. sp_priority_recalc (RN-08).
--
-- Inputs:
--   p_request : JSONB { family_id, source_warehouse_id, coverage_days,
--                       received_by_document?, delivery_latitude?,
--                       delivery_longitude?, notes?, client_op_id? }
--   p_details : JSONB array [{ resource_type_id, quantity, batch? }, …]
--   p_user_id : creator (delivered_by).
--   p_ip / p_user_agent : reserved for audit (#47).
--
-- Returns the deliveries row.

CREATE OR REPLACE FUNCTION sp_delivery_create(
    p_request    JSONB,
    p_details    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS deliveries
LANGUAGE plpgsql AS $$
DECLARE
    v_family_id     INTEGER          := (p_request ->> 'family_id')::INTEGER;
    v_warehouse_id  INTEGER          := (p_request ->> 'source_warehouse_id')::INTEGER;
    v_coverage_days INTEGER          := (p_request ->> 'coverage_days')::INTEGER;
    v_received_doc  TEXT             := NULLIF(p_request ->> 'received_by_document', '');
    v_lat           DOUBLE PRECISION := NULLIF(p_request ->> 'delivery_latitude',  '')::DOUBLE PRECISION;
    v_lng           DOUBLE PRECISION := NULLIF(p_request ->> 'delivery_longitude', '')::DOUBLE PRECISION;
    v_notes         TEXT             := NULLIF(p_request ->> 'notes', '');
    v_client_op_id  TEXT             := NULLIF(p_request ->> 'client_op_id', '');
    -- #46: plan_item_id opcional — propagado desde sp_distribution_plans_execute.
    v_plan_item_id  INTEGER          := NULLIF(p_request ->> 'plan_item_id', '')::INTEGER;

    v_eligibility    RECORD;
    v_existing       deliveries;
    v_delivery_code  TEXT;
    v_delivery       deliveries;
    v_min_food_kg    DOUBLE PRECISION;
    v_food_kg        DOUBLE PRECISION := 0;
    v_detail         JSONB;
    v_unit_weight    DOUBLE PRECISION;
    v_quantity       INTEGER;
    v_resource_id    INTEGER;
    v_category       resource_category;
BEGIN
    -- Parámetros de auditoría usados al final del SP (Issue #47).

    -- 1. Eligibility (RN-02 / HU-23 CA2): must be eligible BEFORE creating anything.
    SELECT * INTO v_eligibility FROM fn_delivery_check_eligibility(v_family_id);
    IF NOT v_eligibility.is_eligible THEN
        RAISE EXCEPTION 'Family not eligible: %', v_eligibility.reason
            USING ERRCODE = 'SH409',
                  DETAIL  = v_eligibility.reason;
    END IF;

    -- 2. Basic field validations.
    IF v_coverage_days IS NULL OR v_coverage_days < 3 THEN
        RAISE EXCEPTION 'coverage_days must be >= 3 (RN-01)' USING ERRCODE = 'SH422';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = v_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_warehouse_id) THEN
        RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'SH404';
    END IF;
    IF p_details IS NULL
       OR jsonb_typeof(p_details) <> 'array'
       OR jsonb_array_length(p_details) = 0 THEN
        RAISE EXCEPTION 'At least one delivery detail is required'
            USING ERRCODE = 'SH422';
    END IF;

    -- 3. Idempotency-Key shortcut (#48 offline replay / CA5).
    IF v_client_op_id IS NOT NULL THEN
        SELECT * INTO v_existing FROM deliveries WHERE client_op_id = v_client_op_id;
        IF FOUND THEN
            RETURN v_existing;
        END IF;
    END IF;

    -- 4. Minimum food ration.
    v_min_food_kg := fn_delivery_min_food_kg(v_family_id, v_coverage_days);

    -- 5. Generate code + insert delivery header (details + stock below).
    v_delivery_code := fn_next_code('ENT');

    INSERT INTO deliveries (
        delivery_code, family_id, source_warehouse_id, coverage_days,
        delivered_by, received_by_document, status,
        delivery_latitude, delivery_longitude,
        exception_reason, exception_authorized_by,
        client_op_id, notes,
        plan_item_id        -- #46: FK a distribution_plan_items (nullable)
    )
    VALUES (
        v_delivery_code, v_family_id, v_warehouse_id, v_coverage_days,
        p_user_id, v_received_doc, 'PROGRAMADA',
        v_lat, v_lng,
        NULL, NULL,         -- no exception fields for regular deliveries
        v_client_op_id, v_notes,
        v_plan_item_id
    )
    RETURNING * INTO v_delivery;

    -- 6. Process each detail: consume inventory + insert delivery_details.
    FOR v_detail IN SELECT * FROM jsonb_array_elements(p_details) LOOP
        v_resource_id := (v_detail ->> 'resource_type_id')::INTEGER;
        v_quantity    := (v_detail ->> 'quantity')::INTEGER;

        SELECT unit_weight_kg, category
          INTO v_unit_weight, v_category
          FROM resource_types
         WHERE id = v_resource_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
        END IF;

        -- FIFO stock consumption — raises SH422 on insufficient stock (CA3).
        PERFORM sp_inventory_consume(v_warehouse_id, v_resource_id, v_quantity);

        INSERT INTO delivery_details (delivery_id, resource_type_id, quantity, weight_kg)
        VALUES (v_delivery.id, v_resource_id, v_quantity, v_quantity * v_unit_weight);

        IF v_category = 'FOOD' THEN
            v_food_kg := v_food_kg + (v_quantity * v_unit_weight);
        END IF;
    END LOOP;

    -- 7. RN-01: total food weight must cover the minimum ration.
    IF v_food_kg < v_min_food_kg THEN
        RAISE EXCEPTION 'Food in delivery (% kg) below minimum ration (% kg) — RN-01',
            v_food_kg, v_min_food_kg
            USING ERRCODE = 'SH422';
    END IF;

    -- Auditoría: CREATE Delivery (Issue #47)
    PERFORM sp_audit_insert(
        'CREATE',
        'deliveries',
        'Delivery',
        v_delivery.id,
        p_user_id,
        NULL,                   -- before = NULL en CREATE
        to_jsonb(v_delivery),
        p_ip,
        p_user_agent
    );

    -- 8. RN-08: refresh priority score after delivery history changed.
    PERFORM sp_priority_recalc(v_family_id);

    RETURN v_delivery;
END $$;
