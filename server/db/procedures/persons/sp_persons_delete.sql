-- Delete a person. Blocked when the person is the last remaining member of
-- the family (RN — RF-04 requires every family to have at least one
-- registered person), surfaced as SH409.
--
-- Raises:
--   SH404 if the person does not exist.
--   SH409 if removing this person would leave the family empty.

CREATE OR REPLACE FUNCTION sp_persons_delete(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_family_id    INTEGER;
    v_member_count INTEGER;
BEGIN
    SELECT family_id INTO v_family_id FROM persons WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Person not found' USING ERRCODE = 'SH404';
    END IF;

    SELECT count(*) INTO v_member_count FROM persons WHERE family_id = v_family_id;
    IF v_member_count <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last member of a family'
            USING ERRCODE = 'SH409';
    END IF;

    DELETE FROM persons WHERE id = p_id;

    PERFORM sp_persons_recalc_aggregates(v_family_id);
END $$;
