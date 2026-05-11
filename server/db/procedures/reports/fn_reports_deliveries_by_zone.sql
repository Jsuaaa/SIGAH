-- fn_reports_deliveries_by_zone(p_from, p_to)
-- Agrega entregas por zona: conteo, peso total y familias atendidas únicas.
-- RF-24, HU-22, HU-29 CA2, Issue #31

CREATE OR REPLACE FUNCTION fn_reports_deliveries_by_zone(
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  zone_id          BIGINT,
  zone_name        TEXT,
  delivery_count   BIGINT,
  total_weight_kg  DOUBLE PRECISION,
  families_attended BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    z.id                                       AS zone_id,
    z.name                                     AS zone_name,
    COUNT(DISTINCT del.id)                     AS delivery_count,
    COALESCE(SUM(dd.weight_kg), 0)::DOUBLE PRECISION AS total_weight_kg,
    COUNT(DISTINCT del.family_id)              AS families_attended
  FROM deliveries del
  JOIN families   f   ON f.id  = del.family_id
  JOIN zones      z   ON z.id  = f.zone_id
  LEFT JOIN delivery_details dd ON dd.delivery_id = del.id
  WHERE (p_from IS NULL OR del.delivery_date::date >= p_from)
    AND (p_to   IS NULL OR del.delivery_date::date <= p_to)
  GROUP BY z.id, z.name
  ORDER BY delivery_count DESC;
$$;
