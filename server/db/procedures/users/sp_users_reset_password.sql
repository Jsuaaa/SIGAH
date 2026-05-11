-- sp_users_reset_password.sql
-- Permite a un ADMIN resetear la contraseña de cualquier usuario.
-- Setea: nuevo hash, password_must_change=true, failed_login_attempts=0,
--        locked_until=NULL.
-- Lanza SH404 si el usuario destino no existe.
-- Audita la acción con sp_audit_insert (Issue #47).

CREATE OR REPLACE FUNCTION sp_users_reset_password(
    p_user_id  INTEGER,
    p_new_hash TEXT,
    p_admin_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_before JSONB;
BEGIN
    SELECT to_jsonb(u) INTO v_before FROM users u WHERE id = p_user_id;

    IF v_before IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    -- Eliminar datos sensibles del snapshot antes de auditar
    v_before := v_before - 'password_hash';

    UPDATE users
       SET password_hash         = p_new_hash,
           password_must_change  = true,
           failed_login_attempts = 0,
           locked_until          = NULL
     WHERE id = p_user_id;

    PERFORM sp_audit_insert(
        'RESET_PASSWORD',
        'users',
        'User',
        p_user_id,
        p_admin_id,
        v_before,
        NULL,   -- after: no exponemos hash nuevo
        NULL,   -- ip no disponible en este SP
        NULL    -- user_agent no disponible en este SP
    );
END $$;
