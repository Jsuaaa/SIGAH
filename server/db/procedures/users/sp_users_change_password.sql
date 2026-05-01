-- Persist a new password hash. The bcrypt comparison of the old password
-- happens in Node (auth.service.ts) before invoking this SP.
-- Raises SH404 if the user does not exist.

CREATE OR REPLACE FUNCTION sp_users_change_password(
    p_id                INTEGER,
    p_new_password_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users
       SET password_hash = p_new_password_hash
     WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;
END $$;
