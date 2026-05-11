-- fn_reports_coverage()
--
-- Returns coverage statistics per zone (Issue #28 / HU-28 CA1).
-- A family is "covered" when it has at least one delivery with:
--   status = 'ENTREGADA'  AND
--   delivery_date + coverage_days * INTERVAL '1 day' > now()
--
-- Returns one row per zone even if it has no families (LEFT JOIN).

CREATE OR REPLACE FUNCTION fn_reports_coverage()
RETURNS TABLE (
    zone_id        INTEGER,
    zone_name      TEXT,
    total_families BIGINT,
    covered        BIGINT,
    uncovered      BIGINT,
    coverage_pct   NUMERIC
)
LANGUAGE sql STABLE AS $$
    WITH covered_families AS (
        -- Distinct families that have at least one active delivery right now.
        SELECT DISTINCT f.id AS family_id
          FROM families f
          JOIN deliveries d ON d.family_id = f.id
         WHERE d.status = 'ENTREGADA'
           AND (d.delivery_date + (d.coverage_days * INTERVAL '1 day')) > now()
           AND f.status IN ('ACTIVO', 'EN_REFUGIO')
    ),
    family_coverage AS (
        -- All active families joined with their coverage status.
        SELECT
            f.zone_id,
            CASE WHEN cf.family_id IS NOT NULL THEN 1 ELSE 0 END AS is_covered
          FROM families f
          LEFT JOIN covered_families cf ON cf.family_id = f.id
         WHERE f.status IN ('ACTIVO', 'EN_REFUGIO')
    ),
    zone_stats AS (
        SELECT
            fc.zone_id,
            COUNT(*)                        AS total_families,
            SUM(fc.is_covered)              AS covered,
            COUNT(*) - SUM(fc.is_covered)   AS uncovered
          FROM family_coverage fc
         GROUP BY fc.zone_id
    )
    SELECT
        z.id                                                            AS zone_id,
        z.name                                                          AS zone_name,
        COALESCE(zs.total_families, 0)::BIGINT                          AS total_families,
        COALESCE(zs.covered,        0)::BIGINT                          AS covered,
        COALESCE(zs.uncovered,      0)::BIGINT                          AS uncovered,
        CASE
            WHEN COALESCE(zs.total_families, 0) = 0 THEN 0::NUMERIC
            ELSE ROUND(
                (COALESCE(zs.covered, 0)::NUMERIC / zs.total_families::NUMERIC) * 100,
                2
            )
        END                                                             AS coverage_pct
      FROM zones z
      LEFT JOIN zone_stats zs ON zs.zone_id = z.id
     ORDER BY z.name ASC;
$$;
