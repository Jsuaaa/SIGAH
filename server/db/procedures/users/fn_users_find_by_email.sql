-- Find a user by email. Returns the full row or no rows.
-- Used by auth.service.ts during login.

CREATE OR REPLACE FUNCTION fn_users_find_by_email(p_email TEXT)
RETURNS SETOF users
LANGUAGE sql STABLE AS $$
    SELECT * FROM users WHERE email = p_email LIMIT 1;
$$;
