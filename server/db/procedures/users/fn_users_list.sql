-- fn_users_list.sql
-- Lista paginada de usuarios con filtros opcionales por role e is_active.
-- Devuelve JSON con { data: User[], total: int, page: int, per_page: int }.

CREATE OR REPLACE FUNCTION fn_users_list(
    p_page      INT     DEFAULT 1,
    p_per_page  INT     DEFAULT 20,
    p_role      TEXT    DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
    id                    INT,
    email                 TEXT,
    name                  TEXT,
    role                  role,
    is_active             BOOLEAN,
    failed_login_attempts INT,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    password_must_change  BOOLEAN,
    created_at            TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ,
    total_count           BIGINT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_offset INT := (GREATEST(p_page, 1) - 1) * GREATEST(p_per_page, 1);
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.is_active,
        u.failed_login_attempts,
        u.locked_until,
        u.last_login_at,
        u.password_must_change,
        u.created_at,
        u.updated_at,
        COUNT(*) OVER () AS total_count
    FROM users u
    WHERE
        (p_role IS NULL     OR u.role::TEXT = p_role)
        AND (p_is_active IS NULL OR u.is_active = p_is_active)
    ORDER BY u.created_at DESC
    LIMIT  GREATEST(p_per_page, 1)
    OFFSET v_offset;
END $$;
