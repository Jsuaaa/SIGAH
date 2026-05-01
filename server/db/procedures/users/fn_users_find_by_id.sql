-- Find a user by primary key. Returns the full row or no rows.
-- Used by auth.service.ts (getProfile, changePassword) and auth middleware.

CREATE OR REPLACE FUNCTION fn_users_find_by_id(p_id INTEGER)
RETURNS SETOF users
LANGUAGE sql STABLE AS $$
    SELECT * FROM users WHERE id = p_id LIMIT 1;
$$;
