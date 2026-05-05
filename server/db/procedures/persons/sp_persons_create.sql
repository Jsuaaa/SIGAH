-- Create a person belonging to a family. Atomic: the row is inserted and the
-- family's aggregate counters are recomputed in the same transaction.
--
-- Raises:
--   SH404 if the family does not exist.
--   SH409 if a person with the same document already exists.
--   SH422 if special_conditions contains a value outside the allowed set,
--          or if birth_date is in the future.

CREATE OR REPLACE FUNCTION sp_persons_create(
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
    v_person persons;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    BEGIN
        INSERT INTO persons (
            family_id, name, document, birth_date, gender, relationship,
            special_conditions, requires_medication
        )
        VALUES (
            p_family_id, p_name, p_document, p_birth_date, p_gender, p_relationship,
            COALESCE(p_special_conditions, '{}'::TEXT[]),
            COALESCE(p_requires_medication, FALSE)
        )
        RETURNING * INTO v_person;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Document already registered' USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'Invalid special_conditions or birth_date' USING ERRCODE = 'SH422';
    END;

    PERFORM sp_persons_recalc_aggregates(p_family_id);

    RETURN v_person;
END $$;
