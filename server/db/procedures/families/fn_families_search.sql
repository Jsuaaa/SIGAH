-- Unified family search across family_code, head_document and
-- reference_address (HU-06, RNF-04). Uses pg_trgm similarity so the indexes
-- created in 006_families.sql can short-circuit the scan and meet the <2s SLA
-- with 12.000 rows.
--
-- Returns a paginated { data, total } shape consistent with fn_families_list.

CREATE OR REPLACE FUNCTION fn_families_search(
    p_query  TEXT,
    p_limit  INTEGER,
    p_offset INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH q AS (
        SELECT COALESCE(NULLIF(trim(p_query), ''), NULL) AS term
    ),
    filtered AS (
        SELECT f.*,
               GREATEST(
                   similarity(f.family_code,                       (SELECT term FROM q)),
                   similarity(f.head_document,                     (SELECT term FROM q)),
                   similarity(COALESCE(f.reference_address, ''),   (SELECT term FROM q))
               ) AS rank
          FROM families f, q
         WHERE q.term IS NOT NULL
           AND (
                f.family_code       ILIKE '%' || q.term || '%'
             OR f.head_document     ILIKE '%' || q.term || '%'
             OR f.reference_address ILIKE '%' || q.term || '%'
           )
    ),
    page AS (
        SELECT * FROM filtered
         ORDER BY rank DESC, id ASC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(jsonb_agg(to_jsonb(p) - 'rank'), '[]'::jsonb) AS data,
        (SELECT count(*) FROM filtered)                         AS total
      FROM page p;
$$;
