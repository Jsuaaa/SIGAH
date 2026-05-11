-- Atomically create an early delivery that bypasses RN-02 (HU-23 CA5).
-- Authorized by COORDINADOR_LOGISTICA — the API enforces the role; the SP
-- additionally validates that exception_reason and exception_authorized_by
-- are present.
--
-- Single transaction:
--   1. Validate family + warehouse exist; the authorizing user exists.
--   2. Validate p_coverage_days >= 3 (RN-01 — table CHECK enforces it; we
--      raise SH422 explicitly so callers get a friendly error).
--   3. Compute the minimum food kg via fn_delivery_min_food_kg.
--   4. For each detail: consume inventory via sp_inventory_consume (FIFO
--      across batches; raises SH422 on insufficient stock).
--   5. Sum the FOOD weight from details and verify it >= min_food_kg
--      (RN-01) — rollback with SH422 otherwise.
--   6. Generate ENT-YYYY-NNNNN.
--   7. INSERT deliveries (status='PROGRAMADA' so the operator can confirm
--      with PUT /:id/status later) + delivery_details.
--   8. sp_priority_recalc (RN-08): families' delivery count reduces
--      priority via the W_DELIVERIES weight (#22 wires this in once the
--      formula reads deliveries — for now the recompute just refreshes
--      breakdown.inputs).
--
-- Inputs:
--   p_request : JSONB { family_id, source_warehouse_id, coverage_days,
--                       exception_reason, exception_authorized_by,
--                       received_by_document?, delivery_latitude?,
--                       delivery_longitude?, notes?, client_op_id? }
--   p_details : JSONB array [{ resource_type_id, quantity, batch? }, …]
--   p_user_id : creator (delivered_by). Audit hook (#28) will use this.
--   p_ip / p_user_agent : reserved for #28.
--
-- Returns the deliveries row.

CREATE OR REPLACE FUNCTION sp_delivery_create_exception(
    p_request    JSONB,
    p_details    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS deliveries
LANGUAGE plpgsql AS $$
DECLARE
    v_family_id     INTEGER := (p_request ->> 'family_id')::INTEGER;
    v_warehouse_id  INTEGER := (p_request ->> 'source_warehouse_id')::INTEGER;
    v_coverage_days INTEGER := (p_request ->> 'coverage_days')::INTEGER;
    v_exception_reason TEXT := NULLIF(p_request ->> 'exception_reason', '');
    v_authorized_by INTEGER := (p_request ->> 'exception_authorized_by')::INTEGER;
    v_received_doc  TEXT    := NULLIF(p_request ->> 'received_by_document', '');
    v_lat           DOUBLE PRECISION := NULLIF(p_request ->> 'delivery_latitude',  '')::DOUBLE PRECISION;
    v_lng           DOUBLE PRECISION := NULLIF(p_request ->> 'delivery_longitude', '')::DOUBLE PRECISION;
    v_notes         TEXT    := NULLIF(p_request ->> 'notes', '');
    v_client_op_id  TEXT    := NULLIF(p_request ->> 'client_op_id', '');

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
    PERFORM p_ip;
    PERFORM p_user_agent;

    -- Validations -----------------------------------------------------------
    IF v_coverage_days IS NULL OR v_coverage_days < 3 THEN
        RAISE EXCEPTION 'coverage_days must be >= 3 (RN-01)' USING ERRCODE = 'SH422';
    END IF;
    IF v_exception_reason IS NULL OR length(trim(v_exception_reason)) = 0 THEN
        RAISE EXCEPTION 'exception_reason is required (HU-23 CA5)'
            USING ERRCODE = 'SH422';
    END IF;
    IF v_authorized_by IS NULL THEN
        RAISE EXCEPTION 'exception_authorized_by is required (HU-23 CA5)'
            USING ERRCODE = 'SH422';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_authorized_by) THEN
        RAISE EXCEPTION 'Authorizing user not found' USING ERRCODE = 'SH404';
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

    -- Idempotency-Key shortcut: if a delivery with this client_op_id already
    -- exists, return it without creating a new one (#48 offline replay).
    IF v_client_op_id IS NOT NULL THEN
        SELECT * INTO v_existing FROM deliveries WHERE client_op_id = v_client_op_id;
        IF FOUND THEN
            RETURN v_existing;
        END IF;
    END IF;

    v_min_food_kg := fn_delivery_min_food_kg(v_family_id, v_coverage_days);

    -- Generate the code & insert the delivery row first so we have an id
    -- for the details. Inventory consumption + ration check happen below;
    -- if any of them raise, the whole function rolls back.
    v_delivery_code := fn_next_code('ENT');

    INSERT INTO deliveries (
        delivery_code, family_id, source_warehouse_id, coverage_days,
        delivered_by, received_by_document, status,
        delivery_latitude, delivery_longitude,
        exception_reason, exception_authorized_by,
        client_op_id, notes
    )
    VALUES (
        v_delivery_code, v_family_id, v_warehouse_id, v_coverage_days,
        p_user_id, v_received_doc, 'PROGRAMADA',
        v_lat, v_lng,
        v_exception_reason, v_authorized_by,
        v_client_op_id, v_notes
    )
    RETURNING * INTO v_delivery;

    -- Process each detail: consume inventory + insert delivery_details.
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

        -- Consume stock (FIFO by expiration_date) — raises SH422 on shortage.
        PERFORM sp_inventory_consume(v_warehouse_id, v_resource_id, v_quantity);

        INSERT INTO delivery_details (delivery_id, resource_type_id, quantity, weight_kg)
        VALUES (v_delivery.id, v_resource_id, v_quantity, v_quantity * v_unit_weight);

        IF v_category = 'FOOD' THEN
            v_food_kg := v_food_kg + (v_quantity * v_unit_weight);
        END IF;
    END LOOP;

    -- RN-01: total food weight must cover the minimum ration.
    IF v_food_kg < v_min_food_kg THEN
        RAISE EXCEPTION 'Food in delivery (% kg) below minimum ration (% kg) — RN-01',
            v_food_kg, v_min_food_kg
            USING ERRCODE = 'SH422';
    END IF;

    -- RN-08: composition / delivery history changed → refresh score.
    PERFORM sp_priority_recalc(v_family_id);

    RETURN v_delivery;
END $$;
