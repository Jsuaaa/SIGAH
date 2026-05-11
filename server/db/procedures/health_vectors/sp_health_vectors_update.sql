-- sp_health_vectors_update
-- Actualiza campos editables de un vector de salud.
-- NULL inputs son ignorados (COALESCE). Raises SH404 si no existe.
-- Campos editables: description, actions_taken, risk_level, latitude, longitude,
--                   zone_id, shelter_id.
-- El estado se actualiza exclusivamente mediante sp_health_vector_set_status.
--
-- audit:#47

CREATE OR REPLACE FUNCTION sp_health_vectors_update(
    p_id         INTEGER,
    p_request    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS health_vectors
LANGUAGE plpgsql AS $$
DECLARE
    v_description TEXT             := NULLIF(p_request ->> 'description',  '');
    v_actions     TEXT             := NULLIF(p_request ->> 'actions_taken', '');
    v_risk_level  risk_level       := NULLIF(p_request ->> 'risk_level',    '')::risk_level;
    v_lat         DOUBLE PRECISION := NULLIF(p_request ->> 'latitude',  '')::DOUBLE PRECISION;
    v_lng         DOUBLE PRECISION := NULLIF(p_request ->> 'longitude', '')::DOUBLE PRECISION;
    v_zone_id     INTEGER          := NULLIF(p_request ->> 'zone_id',    '')::INTEGER;
    v_shelter_id  INTEGER          := NULLIF(p_request ->> 'shelter_id', '')::INTEGER;
    v_before      JSONB;
    v_row         health_vectors;
BEGIN
    SELECT to_jsonb(hv) INTO v_before FROM health_vectors hv WHERE id = p_id;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Health vector % not found', p_id USING ERRCODE = 'SH404';
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

    UPDATE health_vectors
       SET description   = COALESCE(v_description, description),
           actions_taken = COALESCE(v_actions,      actions_taken),
           risk_level    = COALESCE(v_risk_level,   risk_level),
           latitude      = CASE WHEN p_request ? 'latitude'  THEN v_lat  ELSE latitude  END,
           longitude     = CASE WHEN p_request ? 'longitude' THEN v_lng  ELSE longitude END,
           zone_id       = CASE WHEN p_request ? 'zone_id'   THEN v_zone_id    ELSE zone_id    END,
           shelter_id    = CASE WHEN p_request ? 'shelter_id' THEN v_shelter_id ELSE shelter_id END
     WHERE id = p_id
    RETURNING * INTO v_row;

    -- Auditoría: UPDATE HealthVector (Issue #47)
    PERFORM sp_audit_insert(
        'UPDATE',
        'health_vectors',
        'HealthVector',
        v_row.id,
        p_user_id,
        v_before,
        to_jsonb(v_row),
        p_ip,
        p_user_agent
    );

    RETURN v_row;
END $$;
