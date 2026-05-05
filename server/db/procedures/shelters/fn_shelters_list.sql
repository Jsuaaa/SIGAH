-- Paginated shelter listing with optional filters. Returns a single row with
-- `data` (JSONB array) and `total` matching the filters.
--
-- Each shelter row in `data` includes:
--   - all shelter columns
--   - is_over_capacity : TRUE when current_occupancy / max_capacity > 0.9
--                       (HU-10 CA3 — alert when occupation > 90%).
--   - occupancy_ratio  : current_occupancy / max_capacity (0..1).
--
-- Filters:
--   p_zone_id : optional zone filter (NULL = no filter).
--   p_type    : optional shelter_type filter (NULL = no filter).
--   p_search  : optional case-insensitive substring on name/address.
--   p_limit   : page size (must be > 0).
--   p_offset  : rows to skip (must be >= 0).

CREATE OR REPLACE FUNCTION fn_shelters_list(
    p_zone_id INTEGER,
    p_type    shelter_type,
    p_search  TEXT,
    p_limit   INTEGER,
    p_offset  INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT s.*
          FROM shelters s
         WHERE (p_zone_id IS NULL OR s.zone_id = p_zone_id)
           AND (p_type    IS NULL OR s.type    = p_type)
           AND (p_search  IS NULL OR s.name ILIKE '%' || p_search || '%'
                                  OR s.address ILIKE '%' || p_search || '%')
    ),
    page AS (
        SELECT * FROM filtered ORDER BY id ASC LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                to_jsonb(p) || jsonb_build_object(
                    'is_over_capacity', (p.current_occupancy::numeric / NULLIF(p.max_capacity, 0)) > 0.9,
                    'occupancy_ratio',  ROUND((p.current_occupancy::numeric / NULLIF(p.max_capacity, 0))::numeric, 4)
                )
                ORDER BY p.id
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
