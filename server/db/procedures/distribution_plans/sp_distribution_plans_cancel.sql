-- sp_distribution_plans_cancel (Issue #46)
--
-- Cancela un plan de distribución:
--   1. Verifica que el plan exista (SH404).
--   2. Verifica que el status sea PROGRAMADA o EN_EJECUCION (SH422).
--   3. UPDATE plan SET status='CANCELADA'.
--   4. UPDATE items PENDIENTE → SIN_ATENDER con razón 'PLAN_CANCELADO'.
--
-- Inputs:
--   p_plan_id  : id del plan a cancelar.
--   p_user_id  : id del usuario que cancela (reservado para audit #47).

CREATE OR REPLACE FUNCTION sp_distribution_plans_cancel(
    p_plan_id INTEGER,
    p_user_id INTEGER
)
RETURNS distribution_plans
LANGUAGE plpgsql AS $$
DECLARE
    v_plan   distribution_plans;
    v_before JSONB;
BEGIN
    -- p_user_id usado en auditoría al final del SP (Issue #47).

    SELECT * INTO v_plan FROM distribution_plans WHERE id = p_plan_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Distribution plan not found' USING ERRCODE = 'SH404';
    END IF;

    v_before := to_jsonb(v_plan);

    IF v_plan.status NOT IN ('PROGRAMADA', 'EN_EJECUCION') THEN
        RAISE EXCEPTION 'Cannot cancel a plan in status %', v_plan.status
            USING ERRCODE = 'SH422';
    END IF;

    UPDATE distribution_plans
       SET status = 'CANCELADA'
     WHERE id = p_plan_id
    RETURNING * INTO v_plan;

    UPDATE distribution_plan_items
       SET status = 'SIN_ATENDER',
           reason = 'PLAN_CANCELADO'
     WHERE plan_id = p_plan_id
       AND status  = 'PENDIENTE';

    -- Auditoría: CANCEL DistributionPlan (Issue #47)
    PERFORM sp_audit_insert(
        'CANCEL',
        'distribution_plans',
        'DistributionPlan',
        v_plan.id,
        p_user_id,
        v_before,
        to_jsonb(v_plan),
        NULL,   -- ip no disponible en firma actual
        NULL    -- user_agent no disponible en firma actual
    );

    RETURN v_plan;
END $$;
