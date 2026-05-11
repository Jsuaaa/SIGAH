-- Eligibility check for a family receiving a new delivery (RN-02, HU-23 CA2).
--
-- A family is NOT eligible when it has a delivery in status 'ENTREGADA'
-- whose coverage window is still open:
--   delivery_date + (coverage_days * INTERVAL '1 day') > now()
--
-- Returns one row:
--   is_eligible      : boolean
--   reason           : 'ELIGIBLE' | 'COVERED' | … (free-form short code)
--   last_delivery_at : TIMESTAMPTZ of the most recent delivered row, NULL if none
--   coverage_expires : when the latest coverage ends; NULL if never delivered
--   days_remaining   : whole days until coverage_expires (negative when expired)
--   next_eligible_at : when this family becomes eligible again; NULL if already eligible
--
-- Raises SH404 if the family does not exist.

CREATE OR REPLACE FUNCTION fn_delivery_check_eligibility(p_family_id INTEGER)
RETURNS TABLE (
    is_eligible      BOOLEAN,
    reason           TEXT,
    last_delivery_at TIMESTAMPTZ,
    coverage_expires TIMESTAMPTZ,
    days_remaining   INTEGER,
    next_eligible_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_last       TIMESTAMPTZ;
    v_coverage_d INTEGER;
    v_expires    TIMESTAMPTZ;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    SELECT delivery_date, coverage_days
      INTO v_last, v_coverage_d
      FROM deliveries
     WHERE family_id = p_family_id
       AND status    = 'ENTREGADA'
     ORDER BY delivery_date DESC
     LIMIT 1;

    IF NOT FOUND THEN
        -- No delivered rows yet → eligible.
        RETURN QUERY
            SELECT TRUE,
                   'ELIGIBLE'::TEXT,
                   NULL::TIMESTAMPTZ,
                   NULL::TIMESTAMPTZ,
                   NULL::INTEGER,
                   NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_expires := v_last + (v_coverage_d * INTERVAL '1 day');

    IF v_expires > now() THEN
        RETURN QUERY
            SELECT FALSE,
                   'COVERED'::TEXT,
                   v_last,
                   v_expires,
                   GREATEST(EXTRACT(DAY FROM (v_expires - now()))::INTEGER, 0),
                   v_expires;
    ELSE
        RETURN QUERY
            SELECT TRUE,
                   'ELIGIBLE'::TEXT,
                   v_last,
                   v_expires,
                   EXTRACT(DAY FROM (v_expires - now()))::INTEGER,
                   NULL::TIMESTAMPTZ;
    END IF;
END $$;
