-- Update mutable fields of a zone. NULL parameters are ignored (partial update).
-- Raises SH404 if the row does not exist, SH409 on duplicate name.

CREATE OR REPLACE FUNCTION fn_zones_update(
    p_id                   INTEGER,
    p_name                 TEXT,
    p_risk_level           risk_level,
    p_latitude             DOUBLE PRECISION,
    p_longitude            DOUBLE PRECISION,
    p_estimated_population INTEGER
)
RETURNS zones
LANGUAGE plpgsql AS $$
DECLARE
    v_zone zones;
BEGIN
    BEGIN
        UPDATE zones
           SET name                 = COALESCE(p_name, name),
               risk_level           = COALESCE(p_risk_level, risk_level),
               latitude             = COALESCE(p_latitude, latitude),
               longitude            = COALESCE(p_longitude, longitude),
               estimated_population = COALESCE(p_estimated_population, estimated_population)
         WHERE id = p_id
        RETURNING * INTO v_zone;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Zone name already exists' USING ERRCODE = 'SH409';
    END;

    IF v_zone.id IS NULL THEN
        RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_zone;
END $$;
