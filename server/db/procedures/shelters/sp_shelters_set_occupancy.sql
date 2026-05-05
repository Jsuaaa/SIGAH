-- Set the current occupancy of a shelter. Validates that the new value is
-- non-negative and does not exceed max_capacity (RN-10/HU-10 CA2).
--
-- Raises:
--   SH404 if the shelter does not exist
--   SH422 if p_current_occupancy < 0 or > max_capacity

CREATE OR REPLACE FUNCTION sp_shelters_set_occupancy(
    p_id                INTEGER,
    p_current_occupancy INTEGER
)
RETURNS shelters
LANGUAGE plpgsql AS $$
DECLARE
    v_shelter shelters;
BEGIN
    IF p_current_occupancy IS NULL OR p_current_occupancy < 0 THEN
        RAISE EXCEPTION 'Occupancy must be a non-negative integer' USING ERRCODE = 'SH422';
    END IF;

    SELECT * INTO v_shelter FROM shelters WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shelter not found' USING ERRCODE = 'SH404';
    END IF;

    IF p_current_occupancy > v_shelter.max_capacity THEN
        RAISE EXCEPTION 'Occupancy exceeds max capacity' USING ERRCODE = 'SH422';
    END IF;

    UPDATE shelters
       SET current_occupancy = p_current_occupancy
     WHERE id = p_id
    RETURNING * INTO v_shelter;

    RETURN v_shelter;
END $$;
