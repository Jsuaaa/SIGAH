-- sp_users_set_active.sql
-- Permite a un ADMIN activar o desactivar la cuenta de cualquier usuario.
-- Lanza SH404 si el usuario no existe.
-- Audita la acción con sp_audit_insert (Issue #47).

CREATE OR REPLACE FUNCTION sp_users_set_active(
    p_user_id  INTEGER,
    p_active   BOOLEAN,
    p_admin_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_before JSONB;
    v_after  JSONB;
BEGIN
    SELECT to_jsonb(u) - 'password_hash' INTO v_before FROM users u WHERE id = p_user_id;

    IF v_before IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    UPDATE users
       SET is_active = p_active
     WHERE id = p_user_id;

    SELECT to_jsonb(u) - 'password_hash' INTO v_after FROM users u WHERE id = p_user_id;

    PERFORM sp_audit_insert(
        'SET_ACTIVE',
        'users',
        'User',
        p_user_id,
        p_admin_id,
        v_before,
        v_after,
        NULL,   -- ip no disponible en este SP
        NULL    -- user_agent no disponible en este SP
    );
END $$;
