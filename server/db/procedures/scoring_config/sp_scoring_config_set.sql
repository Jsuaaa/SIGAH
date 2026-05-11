-- Update one weight in scoring_config (HU-08 CA5, RN-04). Acts as a strict
-- UPDATE — the keys are seeded by migration 008 and there is no API to add
-- new ones, so a missing key signals a typo.
--
-- Side effect: pg_notify('scoring_config_changed', '<key>') so backend
-- listeners can invalidate the in-memory weight cache.
--
-- Raises:
--   SH404 if the key does not exist (or the user does not exist).
--   SH422 if the value is not finite.

CREATE OR REPLACE FUNCTION sp_scoring_config_set(
    p_key     TEXT,
    p_value   DOUBLE PRECISION,
    p_user_id INTEGER
)
RETURNS scoring_config
LANGUAGE plpgsql AS $$
DECLARE
    v_row scoring_config;
BEGIN
    IF p_value IS NULL OR p_value <> p_value /* NaN check */ THEN
        RAISE EXCEPTION 'value must be a finite number' USING ERRCODE = 'SH422';
    END IF;

    IF p_user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    UPDATE scoring_config
       SET value      = p_value,
           updated_by = p_user_id,
           updated_at = now()
     WHERE key = p_key
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scoring config key not found' USING ERRCODE = 'SH404';
    END IF;

    -- Backend listeners (LISTEN scoring_config_changed) invalidate their
    -- weight cache when this fires; the next priority recompute reads the
    -- fresh value from the table.
    PERFORM pg_notify('scoring_config_changed', p_key);

    RETURN v_row;
END $$;
