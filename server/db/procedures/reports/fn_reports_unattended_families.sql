-- fn_reports_unattended_families(p_zone_id, p_since, p_limit, p_offset)
--
-- Returns active families with no current delivery coverage (Issue #28 / HU-28 CA3).
-- Ordered by priority_score DESC, paginated.
--
-- A family is "unattended" when it has no delivery with:
--   status = 'ENTREGADA' AND delivery_date + coverage_days * INTERVAL '1 day' > now()
--
-- Columns returned per row (as JSONB for consistency):
--   family_id, family_code, family_name, zone_id, zone_name, priority_score,
--   days_since_last_delivery, reason ('NEVER_RECEIVED' | 'COVERAGE_EXPIRED')
--
-- Filters:
--   p_zone_id : optional — restrict to a single zone.
--   p_since   : optional — only include families whose last delivery_date < p_since
--               (i.e. have not received anything since that date). For
--               NEVER_RECEIVED families the filter is ignored (they always match).
--   p_limit, p_offset: pagination.

CREATE OR REPLACE FUNCTION fn_reports_unattended_families(
    p_zone_id  INTEGER,
    p_since    DATE,
    p_limit    INTEGER,
    p_offset   INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH last_delivery AS (
        -- Most recent ENTREGADA delivery per family (regardless of coverage).
        SELECT DISTINCT ON (d.family_id)
               d.family_id,
               d.delivery_date AS last_delivery_date
          FROM deliveries d
         WHERE d.status = 'ENTREGADA'
         ORDER BY d.family_id, d.delivery_date DESC
    ),
    active_families AS (
        SELECT
            f.id                                AS family_id,
            f.family_code                       AS family_code,
            f.head_of_family_name               AS family_name,
            f.zone_id,
            z.name                              AS zone_name,
            f.priority_score,
            f.created_at,
            ld.last_delivery_date,
            -- Check if family currently has an active coverage.
            EXISTS (
                SELECT 1
                  FROM deliveries d2
                 WHERE d2.family_id = f.id
                   AND d2.status = 'ENTREGADA'
                   AND (d2.delivery_date + (d2.coverage_days * INTERVAL '1 day')) > now()
            ) AS has_active_coverage
          FROM families f
          JOIN zones z ON z.id = f.zone_id
          LEFT JOIN last_delivery ld ON ld.family_id = f.id
         WHERE f.status IN ('ACTIVO', 'EN_REFUGIO')
           AND (p_zone_id IS NULL OR f.zone_id = p_zone_id)
    ),
    unattended AS (
        SELECT
            af.*,
            CASE
                WHEN af.last_delivery_date IS NULL THEN 'NEVER_RECEIVED'
                ELSE 'COVERAGE_EXPIRED'
            END AS reason,
            CASE
                WHEN af.last_delivery_date IS NOT NULL
                    THEN EXTRACT(DAY FROM (now() - af.last_delivery_date))::INTEGER
                ELSE EXTRACT(DAY FROM (now() - af.created_at))::INTEGER
            END AS days_since_last_delivery
          FROM active_families af
         WHERE af.has_active_coverage = FALSE
           AND (
               -- p_since filter: last delivery must be before p_since.
               -- NEVER_RECEIVED families always pass.
               p_since IS NULL
               OR af.last_delivery_date IS NULL
               OR af.last_delivery_date::DATE < p_since
           )
    ),
    total_count AS (
        SELECT COUNT(*) AS cnt FROM unattended
    ),
    paged AS (
        SELECT * FROM unattended
         ORDER BY priority_score DESC NULLS LAST, family_id ASC
         LIMIT  p_limit
         OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'family_id',                p.family_id,
                    'family_code',              p.family_code,
                    'family_name',              p.family_name,
                    'zone_id',                  p.zone_id,
                    'zone_name',                p.zone_name,
                    'priority_score',           p.priority_score,
                    'days_since_last_delivery', p.days_since_last_delivery,
                    'reason',                   p.reason
                )
                ORDER BY p.priority_score DESC NULLS LAST, p.family_id ASC
            ),
            '[]'::jsonb
        )                     AS data,
        (SELECT cnt FROM total_count) AS total
      FROM paged p;
$$;
