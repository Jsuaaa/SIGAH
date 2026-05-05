-- Delete a shelter by id. Raises SH404 if it does not exist, SH409 if a
-- dependent record (e.g. families pinned to the shelter — issue #12) blocks
-- the delete.
-- Audit hook (#28) will be added once sp_audit_insert lands.

CREATE OR REPLACE FUNCTION sp_shelters_delete(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        DELETE FROM shelters WHERE id = p_id;
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Shelter is referenced by other records' USING ERRCODE = 'SH409';
    END;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shelter not found' USING ERRCODE = 'SH404';
    END IF;
END $$;
