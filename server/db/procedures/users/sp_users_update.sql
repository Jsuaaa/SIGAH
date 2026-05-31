-- sp_users_update.sql
-- Permite a un ADMIN editar role, name y/o is_active de un usuario.
-- Actualiza solo los campos proporcionados (COALESCE: NULL = no cambiar).
-- Lanza SH404 si el usuario no existe.
-- Audita la acción con sp_audit_insert (HU-01 CA1, Issue #47).

CREATE OR REPLACE FUNCTION sp_users_update(
    p_user_id  INTEGER,
    p_role     role    DEFAULT NULL,
    p_name     TEXT    DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_admin_id INTEGER DEFAULT NULL
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
       SET role      = COALESCE(p_role,      role),
           name      = COALESCE(p_name,      name),
           is_active = COALESCE(p_is_active, is_active),
           updated_at = now()
     WHERE id = p_user_id;

    SELECT to_jsonb(u) - 'password_hash' INTO v_after FROM users u WHERE id = p_user_id;

    PERFORM sp_audit_insert(
        'UPDATE_USER',
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
