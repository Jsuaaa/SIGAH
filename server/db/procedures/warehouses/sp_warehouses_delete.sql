-- Delete a warehouse by id. Raises SH404 if it does not exist, SH409 if a
-- dependent record (e.g. inventory rows once #16 lands) blocks the delete.

CREATE OR REPLACE FUNCTION sp_warehouses_delete(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        DELETE FROM warehouses WHERE id = p_id;
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Warehouse is referenced by other records'
            USING ERRCODE = 'SH409';
    END;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'SH404';
    END IF;
END $$;
