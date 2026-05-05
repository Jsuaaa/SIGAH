-- Create a shelter. Raises SH404 if the zone does not exist, SH409 on
-- duplicate (name, zone_id), SH422 if current_occupancy exceeds max_capacity
-- (the table-level CHECK enforces this at the engine level too — we map the
-- error code so the API surfaces 422 instead of 500).

CREATE OR REPLACE FUNCTION fn_shelters_create(
    p_name              TEXT,
    p_address           TEXT,
    p_zone_id           INTEGER,
    p_max_capacity      INTEGER,
    p_current_occupancy INTEGER,
    p_type              shelter_type,
    p_latitude          DOUBLE PRECISION,
    p_longitude         DOUBLE PRECISION
)
RETURNS shelters
LANGUAGE plpgsql AS $$
DECLARE
    v_shelter shelters;
BEGIN
    BEGIN
        INSERT INTO shelters (
            name, address, zone_id, max_capacity, current_occupancy, type, latitude, longitude
        )
        VALUES (
            p_name, p_address, p_zone_id, p_max_capacity,
            COALESCE(p_current_occupancy, 0), p_type, p_latitude, p_longitude
        )
        RETURNING * INTO v_shelter;
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Shelter name already exists for this zone' USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'Invalid capacity or occupancy values' USING ERRCODE = 'SH422';
    END;

    RETURN v_shelter;
END $$;
