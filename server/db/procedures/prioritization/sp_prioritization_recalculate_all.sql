-- Bulk recompute every family's priority_score (RN-08, HU-21). Iterates the
-- families table calling sp_priority_recalc on each id. Returns the number
-- of families that were touched so the API can include it in the response.
--
-- Heavy-hitting endpoint: should be invoked sparingly (e.g. after editing a
-- weight that doesn't trigger an automatic recompute). Single SP so it can
-- be wrapped in one transaction by the caller's session if needed; we keep
-- the implementation row-by-row to surface SH404 from sp_priority_recalc
-- consistently.

CREATE OR REPLACE FUNCTION sp_prioritization_recalculate_all()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER := 0;
    v_id    INTEGER;
BEGIN
    FOR v_id IN SELECT id FROM families LOOP
        PERFORM sp_priority_recalc(v_id);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END $$;
