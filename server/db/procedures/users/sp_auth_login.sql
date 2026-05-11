-- sp_auth_login.sql
-- Gestiona el flujo de login post-autenticación bcrypt.
-- El caller (Node) ya comparó la contraseña con bcrypt.compare y pasa el
-- resultado como p_password_match BOOLEAN, junto con el timestamp actual.
--
-- Lógica:
--   - Si el usuario no existe          → SH401 (el caller debería haberlo comprobado,
--                                         pero se defiende aquí también)
--   - Si is_active = false             → SH403
--   - Si locked_until > p_now          → SH423
--   - Si p_password_match = false:
--       * Incrementa failed_login_attempts
--       * Si llega a FAILED_LOGIN_LIMIT (5) → setea locked_until = p_now + 15 min
--       * Lanza SH401
--   - Si p_password_match = true:
--       * Resetea failed_login_attempts = 0, locked_until = NULL
--       * Actualiza last_login_at = p_now
--       * Retorna la fila del usuario actualizada
--
-- Retorna SETOF users para poder retornar 0 o 1 fila (la fila actualizada).

CREATE OR REPLACE FUNCTION sp_auth_login(
    p_email          TEXT,
    p_password_match BOOLEAN,
    p_now            TIMESTAMPTZ
)
RETURNS SETOF users
LANGUAGE plpgsql AS $$
DECLARE
    v_user               users;
    v_failed_limit       CONSTANT INT := 5;
    v_lock_minutes       CONSTANT INT := 15;
BEGIN
    -- Buscar usuario
    SELECT * INTO v_user FROM users WHERE email = p_email LIMIT 1;

    IF NOT FOUND THEN
        -- No revelar si el email existe o no (anti-enumeración)
        RAISE EXCEPTION 'Invalid credentials' USING ERRCODE = 'SH401';
    END IF;

    -- Verificar cuenta activa
    IF NOT v_user.is_active THEN
        RAISE EXCEPTION 'Account is disabled' USING ERRCODE = 'SH403';
    END IF;

    -- Verificar lockout (independiente del resultado de la contraseña)
    IF v_user.locked_until IS NOT NULL AND v_user.locked_until > p_now THEN
        RAISE EXCEPTION 'Account is temporarily locked' USING ERRCODE = 'SH423';
    END IF;

    -- Password incorrecto
    IF NOT p_password_match THEN
        -- Incrementar contador (si estaba bloqueado y expiró, reseteamos primero)
        IF v_user.locked_until IS NOT NULL AND v_user.locked_until <= p_now THEN
            -- El bloqueo anterior expiró: reiniciar contador
            UPDATE users
               SET failed_login_attempts = 1,
                   locked_until          = NULL
             WHERE id = v_user.id;
        ELSE
            UPDATE users
               SET failed_login_attempts = failed_login_attempts + 1,
                   locked_until = CASE
                       WHEN failed_login_attempts + 1 >= v_failed_limit
                       THEN p_now + (v_lock_minutes || ' minutes')::INTERVAL
                       ELSE locked_until
                   END
             WHERE id = v_user.id;
        END IF;

        RAISE EXCEPTION 'Invalid credentials' USING ERRCODE = 'SH401';
    END IF;

    -- Password correcto: resetear contador y actualizar last_login_at
    UPDATE users
       SET failed_login_attempts = 0,
           locked_until          = NULL,
           last_login_at         = p_now
     WHERE id = v_user.id
    RETURNING * INTO v_user;

    RETURN NEXT v_user;
    RETURN;
END $$;
