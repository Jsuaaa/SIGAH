-- Delete a zone by id. Raises SH404 if it does not exist.
-- Audit hook (#28) will be added once sp_audit_insert lands.

CREATE OR REPLACE FUNCTION sp_zones_delete(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM zones WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
    END IF;
END $$;
