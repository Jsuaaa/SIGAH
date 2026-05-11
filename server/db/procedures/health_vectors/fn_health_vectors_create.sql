-- fn_health_vectors_create
-- Crea un vector de salud. Valida existencia de zone/shelter si se pasan.
-- Raises SH404 cuando zone_id o shelter_id referenciados no existen.
-- Raises SH422 cuando no se provee ninguna referencia geográfica.
--
-- audit:#47

CREATE OR REPLACE FUNCTION fn_health_vectors_create(
    p_request    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS health_vectors
LANGUAGE plpgsql AS $$
DECLARE
    v_vector_type  vector_type          := (p_request ->> 'vector_type')::vector_type;
    v_risk_level   risk_level           := (p_request ->> 'risk_level')::risk_level;
    v_description  TEXT                 := NULLIF(p_request ->> 'description', '');
    v_actions      TEXT                 := NULLIF(p_request ->> 'actions_taken', '');
    v_lat          DOUBLE PRECISION     := NULLIF(p_request ->> 'latitude',  '')::DOUBLE PRECISION;
    v_lng          DOUBLE PRECISION     := NULLIF(p_request ->> 'longitude', '')::DOUBLE PRECISION;
    v_zone_id      INTEGER              := NULLIF(p_request ->> 'zone_id',   '')::INTEGER;
    v_shelter_id   INTEGER              := NULLIF(p_request ->> 'shelter_id', '')::INTEGER;
    v_reported_at  TIMESTAMPTZ          := COALESCE(
                                               NULLIF(p_request ->> 'reported_date', '')::TIMESTAMPTZ,
                                               now()
                                           );
    v_row          health_vectors;
BEGIN
    -- Validate location constraint before INSERT (clearer message than CHECK violation)
    IF v_zone_id IS NULL AND v_shelter_id IS NULL
       AND (v_lat IS NULL OR v_lng IS NULL) THEN
        RAISE EXCEPTION 'At least one of zone_id, shelter_id, or (latitude+longitude) is required (HU-25)'
            USING ERRCODE = 'SH422';
    END IF;

    -- Validate zone exists if provided
    IF v_zone_id IS NOT NULL THEN
        PERFORM 1 FROM zones WHERE id = v_zone_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Zone % not found', v_zone_id USING ERRCODE = 'SH404';
        END IF;
    END IF;

    -- Validate shelter exists if provided
    IF v_shelter_id IS NOT NULL THEN
        PERFORM 1 FROM shelters WHERE id = v_shelter_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Shelter % not found', v_shelter_id USING ERRCODE = 'SH404';
        END IF;
    END IF;

    INSERT INTO health_vectors (
        vector_type, risk_level, description, actions_taken,
        latitude, longitude, zone_id, shelter_id,
        reported_date, reported_by
    )
    VALUES (
        v_vector_type, v_risk_level, v_description, v_actions,
        v_lat, v_lng, v_zone_id, v_shelter_id,
        v_reported_at, p_user_id
    )
    RETURNING * INTO v_row;

    -- Auditoría: CREATE HealthVector (Issue #47)
    PERFORM sp_audit_insert(
        'CREATE',
        'health_vectors',
        'HealthVector',
        v_row.id,
        p_user_id,
        NULL,
        to_jsonb(v_row),
        p_ip,
        p_user_agent
    );

    RETURN v_row;
END $$;
