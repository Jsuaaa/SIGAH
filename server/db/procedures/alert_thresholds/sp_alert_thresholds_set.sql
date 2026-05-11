-- Upsert the alert threshold for a resource_type (HU-16 CA2). Equivalent to
-- a PUT semantic — there is at most one row per resource_type because of the
-- UNIQUE constraint, so we INSERT … ON CONFLICT.
--
-- Raises SH404 if the resource_type or user does not exist, SH422 if
-- min_quantity is negative.

CREATE OR REPLACE FUNCTION sp_alert_thresholds_set(
    p_resource_type_id INTEGER,
    p_min_quantity     INTEGER,
    p_user_id          INTEGER
)
RETURNS alert_thresholds
LANGUAGE plpgsql AS $$
DECLARE
    v_row alert_thresholds;
BEGIN
    IF p_min_quantity IS NULL OR p_min_quantity < 0 THEN
        RAISE EXCEPTION 'min_quantity must be >= 0' USING ERRCODE = 'SH422';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM resource_types WHERE id = p_resource_type_id) THEN
        RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    INSERT INTO alert_thresholds (resource_type_id, min_quantity, updated_by, updated_at)
    VALUES (p_resource_type_id, p_min_quantity, p_user_id, now())
    ON CONFLICT (resource_type_id)
    DO UPDATE SET
        min_quantity = EXCLUDED.min_quantity,
        updated_by   = EXCLUDED.updated_by,
        updated_at   = now()
    RETURNING * INTO v_row;

    RETURN v_row;
END $$;
