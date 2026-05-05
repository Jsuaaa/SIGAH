-- Soft-delete a resource_type by flipping is_active to FALSE (HU-14 CA4).
-- We never DELETE because the row may be referenced by historical inventory
-- and donation records; deactivating preserves those references while
-- preventing new selections in the API. Raises SH404 if the row does not
-- exist.

CREATE OR REPLACE FUNCTION sp_resource_types_deactivate(p_id INTEGER)
RETURNS resource_types
LANGUAGE plpgsql AS $$
DECLARE
    v_row resource_types;
BEGIN
    UPDATE resource_types
       SET is_active = FALSE
     WHERE id = p_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_row;
END $$;
