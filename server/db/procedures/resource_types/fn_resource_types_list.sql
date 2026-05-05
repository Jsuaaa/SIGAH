-- Paginated listing of resource_types.
--
-- Filters:
--   p_category   : optional resource_category filter.
--   p_is_active  : NULL → all rows (active + inactive); TRUE/FALSE filters.
--   p_search     : optional case-insensitive substring on name.
--   p_limit, p_offset : pagination.

CREATE OR REPLACE FUNCTION fn_resource_types_list(
    p_category  resource_category,
    p_is_active BOOLEAN,
    p_search    TEXT,
    p_limit     INTEGER,
    p_offset    INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT r.*
          FROM resource_types r
         WHERE (p_category  IS NULL OR r.category  = p_category)
           AND (p_is_active IS NULL OR r.is_active = p_is_active)
           AND (p_search    IS NULL OR r.name      ILIKE '%' || p_search || '%')
    ),
    page AS (
        SELECT * FROM filtered ORDER BY category, name, id LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.category, p.name, p.id), '[]'::jsonb) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
