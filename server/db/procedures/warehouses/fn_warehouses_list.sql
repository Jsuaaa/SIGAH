-- Paginated warehouse listing. Returns { data, total } where each warehouse
-- row is enriched with:
--   - is_over_85_percent : current/max > 0.85 (HU-11 CA3 alert).
--   - occupancy_ratio    : current/max (0..1).
--
-- Filters:
--   p_zone_id : optional zone filter.
--   p_status  : optional warehouse_status filter.
--   p_search  : optional case-insensitive substring on name/address.
--   p_limit, p_offset : pagination.

CREATE OR REPLACE FUNCTION fn_warehouses_list(
    p_zone_id INTEGER,
    p_status  warehouse_status,
    p_search  TEXT,
    p_limit   INTEGER,
    p_offset  INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT w.*
          FROM warehouses w
         WHERE (p_zone_id IS NULL OR w.zone_id = p_zone_id)
           AND (p_status  IS NULL OR w.status  = p_status)
           AND (p_search  IS NULL OR w.name    ILIKE '%' || p_search || '%'
                                  OR w.address ILIKE '%' || p_search || '%')
    ),
    page AS (
        SELECT * FROM filtered ORDER BY id ASC LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                to_jsonb(p) || jsonb_build_object(
                    'is_over_85_percent', (p.current_weight_kg / NULLIF(p.max_capacity_kg, 0)) > 0.85,
                    'occupancy_ratio',    ROUND((p.current_weight_kg / NULLIF(p.max_capacity_kg, 0))::numeric, 4)
                )
                ORDER BY p.id
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
