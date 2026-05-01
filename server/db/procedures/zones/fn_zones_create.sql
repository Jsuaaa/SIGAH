-- Create a zone. Raises SH409 if a zone with the same name already exists.

CREATE OR REPLACE FUNCTION fn_zones_create(
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
        INSERT INTO zones (name, risk_level, latitude, longitude, estimated_population)
        VALUES (p_name, p_risk_level, p_latitude, p_longitude, p_estimated_population)
        RETURNING * INTO v_zone;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Zone name already exists' USING ERRCODE = 'SH409';
    END;

    RETURN v_zone;
END $$;
