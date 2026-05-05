-- Partial update of a person. NULL parameters are ignored.
-- Recomputes the family's aggregate counters before returning. If the update
-- moves the person to a different family, both families are recomputed.
--
-- Raises:
--   SH404 if the person or target family does not exist.
--   SH409 on duplicate document.
--   SH422 on invalid special_conditions or future birth_date.

CREATE OR REPLACE FUNCTION sp_persons_update(
    p_id                  INTEGER,
    p_family_id           INTEGER,
    p_name                TEXT,
    p_document            TEXT,
    p_birth_date          DATE,
    p_gender              gender,
    p_relationship        relationship,
    p_special_conditions  TEXT[],
    p_requires_medication BOOLEAN
)
RETURNS persons
LANGUAGE plpgsql AS $$
DECLARE
    v_old_family_id INTEGER;
    v_person        persons;
BEGIN
    SELECT family_id INTO v_old_family_id FROM persons WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Person not found' USING ERRCODE = 'SH404';
    END IF;

    IF p_family_id IS NOT NULL
       AND p_family_id <> v_old_family_id
       AND NOT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    BEGIN
        UPDATE persons
           SET family_id           = COALESCE(p_family_id,           family_id),
               name                = COALESCE(p_name,                name),
               document             = COALESCE(p_document,            document),
               birth_date           = COALESCE(p_birth_date,          birth_date),
               gender               = COALESCE(p_gender,              gender),
               relationship         = COALESCE(p_relationship,        relationship),
               special_conditions   = COALESCE(p_special_conditions,  special_conditions),
               requires_medication  = COALESCE(p_requires_medication, requires_medication)
         WHERE id = p_id
        RETURNING * INTO v_person;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Document already registered' USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'Invalid special_conditions or birth_date' USING ERRCODE = 'SH422';
    END;

    -- Recompute the source family first; if the person moved, also recompute
    -- the destination so both row counts stay correct.
    PERFORM sp_persons_recalc_aggregates(v_old_family_id);
    IF v_person.family_id <> v_old_family_id THEN
        PERFORM sp_persons_recalc_aggregates(v_person.family_id);
    END IF;

    RETURN v_person;
END $$;
