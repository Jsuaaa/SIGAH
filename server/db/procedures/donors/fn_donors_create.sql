-- Create a donor. SH409 on duplicate (name, type), SH422 if contact is blank
-- (the table CHECK already enforces this; we map the error code).

CREATE OR REPLACE FUNCTION fn_donors_create(
    p_name    TEXT,
    p_type    donor_type,
    p_contact TEXT,
    p_tax_id  TEXT
)
RETURNS donors
LANGUAGE plpgsql AS $$
DECLARE
    v_donor donors;
BEGIN
    BEGIN
        INSERT INTO donors (name, type, contact, tax_id)
        VALUES (p_name, p_type, p_contact, NULLIF(p_tax_id, ''))
        RETURNING * INTO v_donor;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Donor with this name and type already exists'
                USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'contact is required (HU-18 CA2)' USING ERRCODE = 'SH422';
    END;

    RETURN v_donor;
END $$;
