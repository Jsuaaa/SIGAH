-- Update mutable fields of a shelter. NULL parameters are ignored (partial update).
-- Raises:
--   SH404 if the shelter or referenced zone does not exist
--   SH409 on duplicate (name, zone_id)
--   SH422 if the resulting current_occupancy > max_capacity

CREATE OR REPLACE FUNCTION fn_shelters_update(
    p_id                INTEGER,
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
        UPDATE shelters
           SET name              = COALESCE(p_name, name),
               address           = COALESCE(p_address, address),
               zone_id           = COALESCE(p_zone_id, zone_id),
               max_capacity      = COALESCE(p_max_capacity, max_capacity),
               current_occupancy = COALESCE(p_current_occupancy, current_occupancy),
               type              = COALESCE(p_type, type),
               latitude          = COALESCE(p_latitude, latitude),
               longitude         = COALESCE(p_longitude, longitude)
         WHERE id = p_id
        RETURNING * INTO v_shelter;
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Shelter name already exists for this zone' USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'Occupancy exceeds max capacity' USING ERRCODE = 'SH422';
    END;

    IF v_shelter.id IS NULL THEN
        RAISE EXCEPTION 'Shelter not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_shelter;
END $$;
