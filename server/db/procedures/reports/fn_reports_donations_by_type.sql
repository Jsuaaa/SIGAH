-- fn_reports_donations_by_type(p_from, p_to)
-- Agrupa donaciones por tipo de donante con subtotales de cantidad y peso.
-- RF-19, HU-19, HU-29 CA1, Issue #31

CREATE OR REPLACE FUNCTION fn_reports_donations_by_type(
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  donor_type           donor_type,
  donation_count       BIGINT,
  total_weight_kg      DOUBLE PRECISION,
  total_monetary_amount NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.type                              AS donor_type,
    COUNT(DISTINCT don.id)              AS donation_count,
    COALESCE(SUM(dd.weight_kg), 0)::DOUBLE PRECISION AS total_weight_kg,
    COALESCE(SUM(don.monetary_amount), 0)              AS total_monetary_amount
  FROM donations     don
  JOIN donors        d   ON d.id = don.donor_id
  LEFT JOIN donation_details dd ON dd.donation_id = don.id
  WHERE (p_from IS NULL OR don.date::date >= p_from)
    AND (p_to   IS NULL OR don.date::date <= p_to)
  GROUP BY d.type
  ORDER BY donation_count DESC;
$$;
