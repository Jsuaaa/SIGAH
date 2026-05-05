-- Eligibility check for a family. Stub until issue #23 lands
-- fn_delivery_check_eligibility — at that point this SP delegates and
-- returns the same shape.
--
-- Current placeholder behavior: returns the family with a permissive flag so
-- the API contract is stable while #23 is pending. Returns SH404 if the
-- family does not exist.

CREATE OR REPLACE FUNCTION fn_families_get_eligibility(p_family_id INTEGER)
RETURNS TABLE (
    family_id           INTEGER,
    family_code         TEXT,
    is_eligible         BOOLEAN,
    reason              TEXT,
    next_eligible_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN QUERY
        SELECT f.id,
               f.family_code,
               TRUE       AS is_eligible,
               'PENDING_DELIVERY_RULES' AS reason,
               NULL::TIMESTAMPTZ        AS next_eligible_at
          FROM families f
         WHERE f.id = p_family_id;
END $$;
