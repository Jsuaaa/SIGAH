-- Atomic donation creation (HU-19, RN-03, RN-07).
--
-- One transaction (the implicit SP-level transaction) runs:
--   1. Validate donor exists and is active. SH404 if missing, SH409 if inactive.
--   2. Validate destination warehouse for IN_KIND/MIXED. SH404 if missing.
--   3. Generate the donation_code via fn_next_code('DON').
--   4. INSERT the donations row.
--   5. For IN_KIND/MIXED: iterate p_details, INSERT each donation_details row,
--      and call sp_inventory_upsert which keeps warehouses.current_weight_kg
--      and inventory.* in sync (RN-03 → SH422 if max_capacity_kg would be
--      exceeded; the whole donation rolls back).
--   6. MONETARY: skip inventory; details are silently ignored. The check
--      constraint on the table enforces the absence of details semantically.
--
-- Inputs:
--   p_donation : JSONB { donor_id, destination_warehouse_id?, donation_type,
--                        monetary_amount?, date?, notes? }
--   p_details  : JSONB array of { resource_type_id, quantity, weight_kg?,
--                                  batch?, expiration_date? }. Optional for
--                MONETARY.
--   p_user_id  : creator (FK users), kept on donations.created_by.
--   p_ip / p_user_agent : reserved for #28 audit hook.
--
-- Returns the donations row.

CREATE OR REPLACE FUNCTION sp_donations_create(
    p_donation   JSONB,
    p_details    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS donations
LANGUAGE plpgsql AS $$
DECLARE
    v_donor_id        INTEGER := (p_donation ->> 'donor_id')::INTEGER;
    v_warehouse_id    INTEGER := NULLIF(p_donation ->> 'destination_warehouse_id', '')::INTEGER;
    v_donation_type   donation_type := (p_donation ->> 'donation_type')::donation_type;
    v_monetary_amount NUMERIC := NULLIF(p_donation ->> 'monetary_amount', '')::NUMERIC;
    v_date            TIMESTAMPTZ := COALESCE((p_donation ->> 'date')::TIMESTAMPTZ, now());
    v_notes           TEXT := NULLIF(p_donation ->> 'notes', '');
    v_donation_code   TEXT;
    v_donation        donations;
    v_donor_active    BOOLEAN;
    v_detail          JSONB;
    v_unit_weight     DOUBLE PRECISION;
    v_quantity        INTEGER;
    v_weight_kg       DOUBLE PRECISION;
    v_batch           TEXT;
    v_expiration_date DATE;
BEGIN
    PERFORM p_ip;
    PERFORM p_user_agent;
    -- (#28 will replace these PERFORM stubs with sp_audit_insert calls.)

    SELECT is_active INTO v_donor_active FROM donors WHERE id = v_donor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Donor not found' USING ERRCODE = 'SH404';
    END IF;
    IF v_donor_active = FALSE THEN
        RAISE EXCEPTION 'Donor is inactive' USING ERRCODE = 'SH409';
    END IF;

    IF v_donation_type IN ('IN_KIND', 'MIXED') THEN
        IF v_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'destination_warehouse_id is required for IN_KIND/MIXED'
                USING ERRCODE = 'SH422';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_warehouse_id) THEN
            RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'SH404';
        END IF;
    END IF;

    v_donation_code := fn_next_code('DON');

    INSERT INTO donations (
        donation_code, donor_id, destination_warehouse_id, donation_type,
        monetary_amount, date, notes, created_by
    )
    VALUES (
        v_donation_code, v_donor_id, v_warehouse_id, v_donation_type,
        v_monetary_amount, v_date, v_notes, p_user_id
    )
    RETURNING * INTO v_donation;

    -- IN_KIND/MIXED: write details + apply inventory effects. MONETARY skips
    -- both; if the caller passes details for a MONETARY donation we ignore
    -- them silently (the API validator already drops them at the boundary).
    IF v_donation_type IN ('IN_KIND', 'MIXED')
       AND p_details IS NOT NULL
       AND jsonb_typeof(p_details) = 'array' THEN

        FOR v_detail IN SELECT * FROM jsonb_array_elements(p_details) LOOP
            v_quantity := (v_detail ->> 'quantity')::INTEGER;
            v_batch    := NULLIF(v_detail ->> 'batch', '');
            v_expiration_date := NULLIF(v_detail ->> 'expiration_date', '')::DATE;

            -- weight_kg is optional in the request: when omitted we derive it
            -- from resource_types.unit_weight_kg so the donation_details row
            -- always has the correct figure.
            SELECT unit_weight_kg INTO v_unit_weight
              FROM resource_types
             WHERE id = (v_detail ->> 'resource_type_id')::INTEGER;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
            END IF;

            v_weight_kg := COALESCE(
                NULLIF(v_detail ->> 'weight_kg', '')::DOUBLE PRECISION,
                v_quantity * v_unit_weight
            );

            INSERT INTO donation_details (
                donation_id, resource_type_id, quantity, weight_kg, batch, expiration_date
            )
            VALUES (
                v_donation.id,
                (v_detail ->> 'resource_type_id')::INTEGER,
                v_quantity,
                v_weight_kg,
                v_batch,
                v_expiration_date
            );

            -- sp_inventory_upsert enforces RN-03 (SH422 if warehouse weight
            -- would exceed max_capacity_kg). Any RAISE inside the SP rolls
            -- back the entire donation transaction, so atomicity is intact.
            PERFORM sp_inventory_upsert(
                v_warehouse_id,
                (v_detail ->> 'resource_type_id')::INTEGER,
                v_quantity,
                v_batch,
                v_expiration_date
            );
        END LOOP;
    END IF;

    RETURN v_donation;
END $$;
