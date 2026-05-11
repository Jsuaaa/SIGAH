-- fn_distribution_plans_find_by_id (Issue #46)
--
-- Devuelve el plan con sus items embebidos como JSONB.
-- Lanza SH404 si no existe.
--
-- Input:
--   p_plan_id : id del plan.

CREATE OR REPLACE FUNCTION fn_distribution_plans_find_by_id(p_plan_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_plan distribution_plans;
BEGIN
    SELECT * INTO v_plan FROM distribution_plans WHERE id = p_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Distribution plan not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN QUERY
    SELECT to_jsonb(v_plan) || jsonb_build_object(
        'items', COALESCE((
            SELECT jsonb_agg(
                to_jsonb(dpi) ORDER BY dpi.priority_score_snapshot DESC
            )
              FROM distribution_plan_items dpi
             WHERE dpi.plan_id = p_plan_id
        ), '[]'::JSONB)
    );
END $$;
