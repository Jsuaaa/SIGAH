-- Eligibility check exposed via GET /families/:id/eligibility. Delegates to
-- fn_delivery_check_eligibility now that #22 lands the deliveries table.
-- Returns the same shape every consumer (prioritization next-batch,
-- delivery creation, …) expects.
--
-- Keeping this thin wrapper means the API contract for families/:id is
-- stable while the underlying definition of "eligible" can evolve.

CREATE OR REPLACE FUNCTION fn_families_get_eligibility(p_family_id INTEGER)
RETURNS TABLE (
    family_id           INTEGER,
    family_code         TEXT,
    is_eligible         BOOLEAN,
    reason              TEXT,
    next_eligible_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_family families;
    v_e      RECORD;
BEGIN
    SELECT * INTO v_family FROM families WHERE id = p_family_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    SELECT * INTO v_e FROM fn_delivery_check_eligibility(p_family_id);

    RETURN QUERY
        SELECT v_family.id,
               v_family.family_code,
               v_e.is_eligible,
               v_e.reason,
               v_e.next_eligible_at;
END $$;
