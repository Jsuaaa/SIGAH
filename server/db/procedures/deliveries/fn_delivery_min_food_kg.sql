-- Minimum food weight (in kg) a delivery must include to satisfy RN-01:
--   0.6 kg/person/day × num_members × coverage_days, with coverage_days >= 3.
--
-- Returns 0 when num_members is 0 (defensive — shouldn't happen because of
-- families.num_members > 0 CHECK). Raises SH404 if the family does not exist.

CREATE OR REPLACE FUNCTION fn_delivery_min_food_kg(
    p_family_id     INTEGER,
    p_coverage_days INTEGER
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_members INTEGER;
BEGIN
    IF p_coverage_days IS NULL OR p_coverage_days < 3 THEN
        RAISE EXCEPTION 'coverage_days must be >= 3 (RN-01)' USING ERRCODE = 'SH422';
    END IF;

    SELECT num_members INTO v_members FROM families WHERE id = p_family_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_members * 0.6 * p_coverage_days;
END $$;
