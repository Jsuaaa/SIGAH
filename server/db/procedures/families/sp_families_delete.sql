-- Delete a family by id. CASCADE removes its privacy_consents (and, once #13
-- lands, its persons / deliveries via the relationships defined there).
-- Raises SH404 if the family does not exist, SH409 if a downstream record
-- (e.g. a delivery, once #22 lands) blocks the delete.

CREATE OR REPLACE FUNCTION sp_families_delete(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        DELETE FROM families WHERE id = p_id;
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Family is referenced by other records' USING ERRCODE = 'SH409';
    END;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;
END $$;
