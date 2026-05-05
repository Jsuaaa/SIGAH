-- Atomic family creation with privacy consent (RN-07, RN-09).
--
-- Validates that p_consent->>'privacy_consent_accepted' = 'true' (RN-09 →
-- SH422). Generates a sequential FAM-YYYY-NNNNN code. Inserts the family +
-- privacy_consents rows in the same transaction so either both succeed or
-- neither does.
--
-- Audit hook (#28) lands later: once sp_audit_insert exists this SP must call
-- it before returning so every census mutation is recorded.
--
-- Inputs
--   p_family : JSONB with the family columns. Required keys:
--                head_document, zone_id, num_members
--              Optional: shelter_id, num_children_under_5, num_adults_over_65,
--                        num_pregnant, num_disabled, status, latitude,
--                        longitude, reference_address
--   p_consent: JSONB. Required: { "privacy_consent_accepted": true }.
--   p_user_id: who registered the family (FK users).
--   p_ip     : caller IP (forwarded from controller).
--   p_user_agent: request user-agent (kept for #28 once auditing lands).

CREATE OR REPLACE FUNCTION sp_families_create_with_consent(
    p_family     JSONB,
    p_consent    JSONB,
    p_user_id    INTEGER,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS families
LANGUAGE plpgsql AS $$
DECLARE
    v_family       families;
    v_family_code  TEXT;
    v_zone_id      INTEGER := (p_family ->> 'zone_id')::INTEGER;
    v_shelter_id   INTEGER := NULLIF(p_family ->> 'shelter_id', '')::INTEGER;
BEGIN
    -- p_user_agent reserved for #28 (audit). Reference it so static analyzers
    -- and future readers see it is intentionally captured.
    PERFORM p_user_agent;

    -- RN-09: privacy consent must be explicitly accepted.
    IF COALESCE((p_consent ->> 'privacy_consent_accepted')::BOOLEAN, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'Privacy consent (Ley 1581/2012) is required'
            USING ERRCODE = 'SH422';
    END IF;

    -- Validate FK existence up-front to surface SH404 (the FK violation in the
    -- INSERT would also do it, but doing it explicitly gives a clearer error).
    IF NOT EXISTS (SELECT 1 FROM zones WHERE id = v_zone_id) THEN
        RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
    END IF;
    IF v_shelter_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM shelters WHERE id = v_shelter_id) THEN
        RAISE EXCEPTION 'Shelter not found' USING ERRCODE = 'SH404';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    -- RN-07: sequential FAM-YYYY-NNNNN.
    v_family_code := fn_next_code('FAM');

    BEGIN
        INSERT INTO families (
            family_code, head_document, zone_id, shelter_id, num_members,
            num_children_under_5, num_adults_over_65, num_pregnant, num_disabled,
            status, latitude, longitude, reference_address
        )
        VALUES (
            v_family_code,
            p_family ->> 'head_document',
            v_zone_id,
            v_shelter_id,
            (p_family ->> 'num_members')::INTEGER,
            COALESCE((p_family ->> 'num_children_under_5')::INTEGER, 0),
            COALESCE((p_family ->> 'num_adults_over_65')::INTEGER,  0),
            COALESCE((p_family ->> 'num_pregnant')::INTEGER,        0),
            COALESCE((p_family ->> 'num_disabled')::INTEGER,        0),
            COALESCE((p_family ->> 'status')::family_status,        'ACTIVO'),
            NULLIF(p_family ->> 'latitude',  '')::DOUBLE PRECISION,
            NULLIF(p_family ->> 'longitude', '')::DOUBLE PRECISION,
            NULLIF(p_family ->> 'reference_address', '')
        )
        RETURNING * INTO v_family;
    EXCEPTION
        WHEN check_violation THEN
            RAISE EXCEPTION 'Invalid family aggregate counts' USING ERRCODE = 'SH422';
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Family code collision' USING ERRCODE = 'SH409';
    END;

    INSERT INTO privacy_consents (family_id, accepted_by_user_id, law_version, ip_address)
    VALUES (
        v_family.id,
        p_user_id,
        COALESCE(NULLIF(p_consent ->> 'law_version', ''), 'Ley 1581/2012'),
        p_ip
    );

    -- Set the initial priority_score from the declared aggregates so the
    -- family is rankable before any persons are added (RN-08). Subsequent
    -- person/zone mutations recompute via sp_persons_recalc_aggregates and
    -- sp_families_update.
    PERFORM sp_priority_recalc(v_family.id);
    SELECT * INTO v_family FROM families WHERE id = v_family.id;

    RETURN v_family;
END $$;
