-- Paginated donor listing.
--
-- Filters:
--   p_type      : optional donor_type filter.
--   p_is_active : NULL → all; TRUE/FALSE filter.
--   p_search    : optional case-insensitive substring on name (uses pg_trgm).
--   p_limit, p_offset : pagination.

CREATE OR REPLACE FUNCTION fn_donors_list(
    p_type      donor_type,
    p_is_active BOOLEAN,
    p_search    TEXT,
    p_limit     INTEGER,
    p_offset    INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT d.*
          FROM donors d
         WHERE (p_type      IS NULL OR d.type      = p_type)
           AND (p_is_active IS NULL OR d.is_active = p_is_active)
           AND (p_search    IS NULL OR d.name      ILIKE '%' || p_search || '%')
    ),
    page AS (
        SELECT * FROM filtered ORDER BY name, id LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.name, p.id), '[]'::jsonb) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
