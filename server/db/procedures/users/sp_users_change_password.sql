-- sp_users_change_password.sql
-- Persiste un nuevo hash de contraseña y resetea password_must_change=false.
-- La comparación bcrypt del password viejo ocurre en Node antes de llamar a
-- este SP. Lanza SH404 si el usuario no existe.

CREATE OR REPLACE FUNCTION sp_users_change_password(
    p_id                INTEGER,
    p_new_password_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users
       SET password_hash        = p_new_password_hash,
           password_must_change = false,
           failed_login_attempts = 0,
           locked_until          = NULL
     WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;
END $$;
