-- Partial update of a donor (NULL inputs are ignored). Raises:
--   SH404 when the row does not exist.
--   SH409 on duplicate (name, type).
--   SH422 when contact is set to a blank string.

CREATE OR REPLACE FUNCTION sp_donors_update(
    p_id        INTEGER,
    p_name      TEXT,
    p_type      donor_type,
    p_contact   TEXT,
    p_tax_id    TEXT,
    p_is_active BOOLEAN
)
RETURNS donors
LANGUAGE plpgsql AS $$
DECLARE
    v_row donors;
BEGIN
    BEGIN
        UPDATE donors
           SET name      = COALESCE(p_name,      name),
               type      = COALESCE(p_type,      type),
               contact   = COALESCE(p_contact,   contact),
               tax_id    = COALESCE(p_tax_id,    tax_id),
               is_active = COALESCE(p_is_active, is_active)
         WHERE id = p_id
        RETURNING * INTO v_row;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Donor with this name and type already exists'
                USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'contact is required (HU-18 CA2)' USING ERRCODE = 'SH422';
    END;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Donor not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_row;
END $$;
