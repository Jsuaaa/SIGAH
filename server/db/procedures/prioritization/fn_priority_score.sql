-- Compute the priority score of a family (RN-04, RN-08).
--
-- Reads weights from scoring_config (HU-08 CA5) and returns both the total
-- and a breakdown JSONB so the API can render the per-factor contribution
-- expected by HU-08 CA2.
--
-- Formula (PLAN.md §Prioritization):
--   score = (W_MEMBERS      * num_members)
--         + (W_CHILDREN_5   * num_children_under_5)
--         + (W_ADULTS_65    * num_adults_over_65)
--         + (W_PREGNANT     * num_pregnant)
--         + (W_DISABLED     * num_disabled)
--         + (W_ZONE_RISK    * zone_risk_factor)        -- LOW=1..CRITICAL=4
--         + (W_DAYS_NO_AID  * LEAST(days_without_aid, MAX_DAYS))
--         - (W_DELIVERIES   * deliveries_received)
--
-- `days_without_aid` and `deliveries_received` depend on the deliveries
-- table (#22). Until that lands, both factors evaluate to 0 — the function
-- still returns a valid score, just one that doesn't yet reflect delivery
-- history. The breakdown JSONB exposes them so the gap is visible to API
-- consumers.

CREATE OR REPLACE FUNCTION fn_priority_score(p_family_id INTEGER)
RETURNS TABLE (total DOUBLE PRECISION, breakdown JSONB)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_family            families;
    v_zone_risk_factor  INTEGER := 0;

    v_w_members         DOUBLE PRECISION;
    v_w_children_5      DOUBLE PRECISION;
    v_w_adults_65       DOUBLE PRECISION;
    v_w_pregnant        DOUBLE PRECISION;
    v_w_disabled        DOUBLE PRECISION;
    v_w_zone_risk       DOUBLE PRECISION;
    v_w_days_no_aid     DOUBLE PRECISION;
    v_w_deliveries      DOUBLE PRECISION;
    v_max_days          DOUBLE PRECISION;

    v_days_no_aid       DOUBLE PRECISION := 0;
    v_deliveries        DOUBLE PRECISION := 0;

    c_members           DOUBLE PRECISION;
    c_children          DOUBLE PRECISION;
    c_elders            DOUBLE PRECISION;
    c_pregnant          DOUBLE PRECISION;
    c_disabled          DOUBLE PRECISION;
    c_zone              DOUBLE PRECISION;
    c_days              DOUBLE PRECISION;
    c_deliveries        DOUBLE PRECISION;
    v_total             DOUBLE PRECISION;
BEGIN
    SELECT * INTO v_family FROM families WHERE id = p_family_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    -- Map zone risk_level -> integer factor.
    SELECT CASE z.risk_level
               WHEN 'LOW'      THEN 1
               WHEN 'MEDIUM'   THEN 2
               WHEN 'HIGH'     THEN 3
               WHEN 'CRITICAL' THEN 4
           END
      INTO v_zone_risk_factor
      FROM zones z
     WHERE z.id = v_family.zone_id;

    -- Pull every weight in one round-trip via a pivot.
    SELECT
        COALESCE(MAX(value) FILTER (WHERE key = 'W_MEMBERS'),     0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_CHILDREN_5'),  0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_ADULTS_65'),   0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_PREGNANT'),    0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_DISABLED'),    0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_ZONE_RISK'),   0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_DAYS_NO_AID'), 0),
        COALESCE(MAX(value) FILTER (WHERE key = 'W_DELIVERIES'),  0),
        COALESCE(MAX(value) FILTER (WHERE key = 'MAX_DAYS'),     30)
      INTO v_w_members, v_w_children_5, v_w_adults_65, v_w_pregnant,
           v_w_disabled, v_w_zone_risk, v_w_days_no_aid, v_w_deliveries,
           v_max_days
      FROM scoring_config;

    -- Deliveries received (#20 CA2): count of ENTREGADA rows for this family.
    SELECT COUNT(*)::DOUBLE PRECISION
      INTO v_deliveries
      FROM deliveries
     WHERE family_id = p_family_id
       AND status = 'ENTREGADA';

    -- Days without aid (#20 CA2): days since last ENTREGADA delivery, capped
    -- at v_max_days. Falls back to days since family.created_at when no
    -- delivery exists yet.
    SELECT LEAST(
        COALESCE(
            EXTRACT(DAY FROM (now() - MAX(d.delivery_date)))::DOUBLE PRECISION,
            EXTRACT(DAY FROM (now() - v_family.created_at))::DOUBLE PRECISION
        ),
        v_max_days
    )
      INTO v_days_no_aid
      FROM deliveries d
     WHERE d.family_id = p_family_id
       AND d.status = 'ENTREGADA';

    c_members    := v_w_members     * v_family.num_members;
    c_children   := v_w_children_5  * v_family.num_children_under_5;
    c_elders     := v_w_adults_65   * v_family.num_adults_over_65;
    c_pregnant   := v_w_pregnant    * v_family.num_pregnant;
    c_disabled   := v_w_disabled    * v_family.num_disabled;
    c_zone       := v_w_zone_risk   * v_zone_risk_factor;
    c_days       := v_w_days_no_aid * LEAST(v_days_no_aid, v_max_days);
    c_deliveries := v_w_deliveries  * v_deliveries;

    v_total := c_members + c_children + c_elders + c_pregnant + c_disabled
             + c_zone    + c_days     - c_deliveries;

    RETURN QUERY SELECT
        v_total,
        jsonb_build_object(
            'members',        c_members,
            'children_u5',    c_children,
            'adults_o65',     c_elders,
            'pregnant',       c_pregnant,
            'disabled',       c_disabled,
            'zone_risk',      c_zone,
            'days_no_aid',    c_days,
            'deliveries',    -c_deliveries,
            'inputs', jsonb_build_object(
                'num_members',          v_family.num_members,
                'num_children_under_5', v_family.num_children_under_5,
                'num_adults_over_65',   v_family.num_adults_over_65,
                'num_pregnant',         v_family.num_pregnant,
                'num_disabled',         v_family.num_disabled,
                'zone_risk_factor',     v_zone_risk_factor,
                'days_without_aid',     v_days_no_aid,
                'deliveries_received',  v_deliveries,
                'max_days',             v_max_days
            ),
            'weights', jsonb_build_object(
                'W_MEMBERS',     v_w_members,
                'W_CHILDREN_5',  v_w_children_5,
                'W_ADULTS_65',   v_w_adults_65,
                'W_PREGNANT',    v_w_pregnant,
                'W_DISABLED',    v_w_disabled,
                'W_ZONE_RISK',   v_w_zone_risk,
                'W_DAYS_NO_AID', v_w_days_no_aid,
                'W_DELIVERIES',  v_w_deliveries
            )
        );
END $$;
