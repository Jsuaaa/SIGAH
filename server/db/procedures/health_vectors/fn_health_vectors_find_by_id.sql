-- fn_health_vectors_find_by_id
-- Retorna el vector de salud con snapshot de zona y refugio.
-- Raises SH404 si no existe.

CREATE OR REPLACE FUNCTION fn_health_vectors_find_by_id(
    p_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT
        to_jsonb(hv) - 'zone_id' - 'shelter_id'
        || jsonb_build_object(
            'zone_id',   hv.zone_id,
            'shelter_id', hv.shelter_id,
            'zone',       to_jsonb(z),
            'shelter',    to_jsonb(s)
        )
    INTO v_result
    FROM health_vectors hv
    LEFT JOIN zones    z ON z.id = hv.zone_id
    LEFT JOIN shelters s ON s.id = hv.shelter_id
    WHERE hv.id = p_id;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Health vector % not found', p_id USING ERRCODE = 'SH404';
    END IF;

    RETURN v_result;
END $$;
