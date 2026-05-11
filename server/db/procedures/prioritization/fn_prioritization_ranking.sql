-- Paginated ranking of families by priority_score DESC (HU-08, HU-21).
--
-- Each row carries the full family snapshot plus zone name and the
-- last_delivery_date (NULL until #22 lands). The breakdown column lives on
-- families.priority_score_breakdown so the UI gets it for free.
--
-- Filters:
--   p_zone_id : optional.
--   p_status  : optional family_status filter.
--   p_limit, p_offset : pagination.

CREATE OR REPLACE FUNCTION fn_prioritization_ranking(
    p_zone_id INTEGER,
    p_status  family_status,
    p_limit   INTEGER,
    p_offset  INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT f.*,
               z.name AS zone_name,
               (SELECT MAX(d.delivery_date)
                  FROM deliveries d
                 WHERE d.family_id = f.id
                   AND d.status    = 'ENTREGADA') AS last_delivery_date
          FROM families f
          JOIN zones z ON z.id = f.zone_id
         WHERE (p_zone_id IS NULL OR f.zone_id = p_zone_id)
           AND (p_status  IS NULL OR f.status  = p_status)
    ),
    page AS (
        SELECT * FROM filtered
         ORDER BY priority_score DESC, id ASC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id',                       p.id,
                    'family_code',              p.family_code,
                    'head_document',            p.head_document,
                    'zone_id',                  p.zone_id,
                    'zone_name',                p.zone_name,
                    'shelter_id',               p.shelter_id,
                    'num_members',              p.num_members,
                    'num_children_under_5',     p.num_children_under_5,
                    'num_adults_over_65',       p.num_adults_over_65,
                    'num_pregnant',             p.num_pregnant,
                    'num_disabled',             p.num_disabled,
                    'priority_score',           p.priority_score,
                    'priority_score_breakdown', p.priority_score_breakdown,
                    'status',                   p.status,
                    'last_delivery_date',       p.last_delivery_date
                )
                ORDER BY p.priority_score DESC, p.id ASC
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
