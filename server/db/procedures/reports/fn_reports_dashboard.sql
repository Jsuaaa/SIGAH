-- fn_reports_dashboard()
-- Dashboard de métricas clave construido con una sola query JSONB (evita N+1).
-- Cubre: familias, coberturas, entregas, stock bajo, vectores, refugios, donaciones.
-- RF-04, RF-07, RF-14, RF-15, RF-17, RF-31, HU-28, HU-29 CA3, Issue #31

CREATE OR REPLACE FUNCTION fn_reports_dashboard()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH
  families_stats AS (
    SELECT
      COUNT(*)                                                     AS total_families,
      COUNT(*) FILTER (WHERE status IN ('ACTIVO','EN_REFUGIO','EVACUADO')) AS total_active_families
    FROM families
  ),
  coverage AS (
    -- Una familia está "cubierta" si tiene una entrega cuya cobertura vigente aún no venció
    SELECT
      COUNT(DISTINCT f.id) AS families_covered
    FROM families f
    WHERE EXISTS (
      SELECT 1
      FROM deliveries d
      WHERE d.family_id = f.id
        AND d.status = 'ENTREGADA'
        AND (d.delivery_date + (d.coverage_days || ' days')::interval) >= NOW()
    )
  ),
  deliveries_today AS (
    SELECT COUNT(*) AS cnt
    FROM deliveries
    WHERE delivery_date::date = CURRENT_DATE
      AND status != 'PROGRAMADA'
  ),
  deliveries_week AS (
    SELECT COUNT(*) AS cnt
    FROM deliveries
    WHERE delivery_date >= date_trunc('week', NOW())
      AND status != 'PROGRAMADA'
  ),
  low_stock AS (
    SELECT COUNT(*) AS cnt
    FROM inventory i
    JOIN alert_thresholds at ON at.resource_type_id = i.resource_type_id
    WHERE i.available_quantity <= at.min_quantity
  ),
  health_vectors_active AS (
    SELECT COUNT(*) AS cnt
    FROM health_vectors
    WHERE status = 'ACTIVO'
  ),
  shelters_stats AS (
    SELECT
      CASE
        WHEN SUM(max_capacity) = 0 THEN 0
        ELSE ROUND(
          SUM(current_occupancy)::numeric * 100 / NULLIF(SUM(max_capacity), 0),
          2
        )
      END AS occupied_pct
    FROM shelters
  ),
  recent_donations AS (
    SELECT COUNT(*) AS cnt
    FROM donations
    WHERE date >= NOW() - INTERVAL '7 days'
  )
  SELECT jsonb_build_object(
    'total_families',          fs.total_families,
    'total_active_families',   fs.total_active_families,
    'families_covered',        cv.families_covered,
    'families_uncovered',      fs.total_families - cv.families_covered,
    'total_deliveries_today',  dt.cnt,
    'total_deliveries_week',   dw.cnt,
    'low_stock_count',         ls.cnt,
    'active_health_vectors',   hv.cnt,
    'occupied_shelters_pct',   ss.occupied_pct,
    'recent_donations_7d',     rd.cnt
  )
  FROM families_stats fs,
       coverage       cv,
       deliveries_today dt,
       deliveries_week  dw,
       low_stock        ls,
       health_vectors_active hv,
       shelters_stats   ss,
       recent_donations rd;
$$;
