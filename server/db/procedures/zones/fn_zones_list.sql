-- Paginated zone listing with optional filters. Returns a single row
-- containing the page (`data` as JSONB array) and the total number of rows
-- that match the filters (`total`). Replaces the prisma.$transaction(
-- [findMany, count]) pattern used in the previous implementation.
--
-- Filters:
--   p_risk_level : optional risk_level enum value (NULL = no filter)
--   p_search     : optional case-insensitive substring on name
--   p_limit      : page size (must be > 0)
--   p_offset     : rows to skip (must be >= 0)

CREATE OR REPLACE FUNCTION fn_zones_list(
    p_risk_level risk_level,
    p_search     TEXT,
    p_limit      INTEGER,
    p_offset     INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT z.*
          FROM zones z
         WHERE (p_risk_level IS NULL OR z.risk_level = p_risk_level)
           AND (p_search     IS NULL OR z.name ILIKE '%' || p_search || '%')
    ),
    page AS (
        SELECT * FROM filtered ORDER BY id ASC LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb) AS data,
        (SELECT count(*) FROM filtered)                              AS total
      FROM page p;
$$;
