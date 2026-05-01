-- Create a user. Password hash is computed in Node (bcrypt) and passed in.
-- Raises SH409 if the email is already taken.

CREATE OR REPLACE FUNCTION fn_users_create(
    p_email         TEXT,
    p_password_hash TEXT,
    p_role          role
)
RETURNS users
LANGUAGE plpgsql AS $$
DECLARE
    v_user users;
BEGIN
    BEGIN
        INSERT INTO users (email, password_hash, role)
        VALUES (p_email, p_password_hash, p_role)
        RETURNING * INTO v_user;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Email already registered' USING ERRCODE = 'SH409';
    END;

    RETURN v_user;
END $$;
