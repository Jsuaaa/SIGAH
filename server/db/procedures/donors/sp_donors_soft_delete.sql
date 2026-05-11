-- Hybrid delete:
--   - If the donor has zero donations attached, DELETE the row.
--   - Otherwise flip is_active to FALSE so the historical donations keep
--     resolving the FK while the donor disappears from active selectors.
--
-- The `donations` table will land in #19. To keep the SP idempotent across
-- the migration ordering, we check `to_regclass` before counting — if the
-- table does not yet exist we treat the count as 0 and DELETE.
--
-- Returns the donor row (with updated is_active when soft-deleted) or
-- raises SH404 if the donor does not exist.

CREATE OR REPLACE FUNCTION sp_donors_soft_delete(p_id INTEGER)
RETURNS donors
LANGUAGE plpgsql AS $$
DECLARE
    v_row    donors;
    v_count  INTEGER := 0;
BEGIN
    SELECT * INTO v_row FROM donors WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Donor not found' USING ERRCODE = 'SH404';
    END IF;

    IF to_regclass('public.donations') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM donations WHERE donor_id = $1'
           INTO v_count
          USING p_id;
    END IF;

    IF v_count = 0 THEN
        DELETE FROM donors WHERE id = p_id;
        RETURN v_row;  -- last known state before the delete
    END IF;

    UPDATE donors
       SET is_active = FALSE
     WHERE id = p_id
    RETURNING * INTO v_row;

    RETURN v_row;
END $$;
