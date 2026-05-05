-- Recompute and persist the priority_score + priority_score_breakdown of a
-- family (RN-08). Calls fn_priority_score and writes the result back to the
-- families row.
--
-- Used by:
--   - sp_persons_recalc_aggregates (person create/update/delete).
--   - sp_families_update           (zone changes affect zone_risk_factor).
--   - sp_delivery_create / sp_distribution_plan_execute (#22, #21+).
--   - manual recalculation endpoint (#21 — POST /prioritization/recalculate).

CREATE OR REPLACE FUNCTION sp_priority_recalc(p_family_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_total     DOUBLE PRECISION;
    v_breakdown JSONB;
BEGIN
    SELECT total, breakdown
      INTO v_total, v_breakdown
      FROM fn_priority_score(p_family_id);

    UPDATE families
       SET priority_score           = v_total,
           priority_score_breakdown = v_breakdown
     WHERE id = p_family_id;
END $$;
