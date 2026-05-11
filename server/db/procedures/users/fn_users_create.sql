-- fn_users_create.sql
-- Crea un usuario nuevo. El hash de la contraseña se computa en Node (bcrypt)
-- y se pasa como parámetro. Activa password_must_change=true porque la
-- contraseña es temporal (HU-01 CA5).
-- Lanza SH409 si el email ya está registrado.

CREATE OR REPLACE FUNCTION fn_users_create(
    p_email              TEXT,
    p_password_hash      TEXT,
    p_role               role,
    p_name               TEXT DEFAULT ''
)
RETURNS users
LANGUAGE plpgsql AS $$
DECLARE
    v_user users;
BEGIN
    BEGIN
        INSERT INTO users (email, password_hash, role, name, is_active, password_must_change)
        VALUES (p_email, p_password_hash, p_role, p_name, true, true)
        RETURNING * INTO v_user;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Email already registered' USING ERRCODE = 'SH409';
    END;

    RETURN v_user;
END $$;
