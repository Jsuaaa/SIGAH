-- fn_map_zones_without_deliveries(p_days INT)
-- Returns zones that have zero deliveries with status='ENTREGADA' in the last p_days days.
-- Also returns estimated_population and count of registered families.
-- (HU-30 CA1, HU-30 CA5: zones without deliveries, with population and family count)
CREATE OR REPLACE FUNCTION fn_map_zones_without_deliveries(p_days INT DEFAULT 30)
RETURNS TABLE(
  zone_id          INT,
  zone_name        TEXT,
  risk_level       TEXT,
  estimated_population INT,
  family_count     BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    z.id            AS zone_id,
    z.name          AS zone_name,
    z.risk_level::text AS risk_level,
    z.estimated_population,
    COUNT(f.id)     AS family_count
  FROM zones z
  LEFT JOIN families f ON f.zone_id = z.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM deliveries d
    JOIN families fj ON d.family_id = fj.id
    WHERE fj.zone_id = z.id
      AND d.status = 'ENTREGADA'
      AND d.delivery_date >= (NOW() - (p_days || ' days')::interval)
  )
  GROUP BY z.id, z.name, z.risk_level, z.estimated_population
  ORDER BY z.name;
$$;
