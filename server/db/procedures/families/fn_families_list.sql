-- Paginated family listing with optional filters and sorting.
--
-- Returns a single row { data: jsonb, total: bigint }.
--
-- Filters:
--   p_zone_id    : optional zone filter.
--   p_shelter_id : optional shelter filter.
--   p_status     : optional family_status filter.
--   p_order_by   : 'priority_score_desc' (default), 'created_at_desc',
--                  'family_code_asc'.
--   p_limit, p_offset : pagination.

CREATE OR REPLACE FUNCTION fn_families_list(
    p_zone_id    INTEGER,
    p_shelter_id INTEGER,
    p_status     family_status,
    p_order_by   TEXT,
    p_limit      INTEGER,
    p_offset     INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_order TEXT := COALESCE(p_order_by, 'priority_score_desc');
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT f.*
          FROM families f
         WHERE (p_zone_id    IS NULL OR f.zone_id    = p_zone_id)
           AND (p_shelter_id IS NULL OR f.shelter_id = p_shelter_id)
           AND (p_status     IS NULL OR f.status     = p_status)
    ),
    page AS (
        SELECT *
          FROM filtered
         ORDER BY
            CASE WHEN v_order = 'priority_score_desc' THEN priority_score END DESC NULLS LAST,
            CASE WHEN v_order = 'created_at_desc'     THEN created_at     END DESC NULLS LAST,
            CASE WHEN v_order = 'family_code_asc'     THEN family_code    END ASC  NULLS LAST,
            id ASC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) AS data,
        (SELECT count(*) FROM filtered)               AS total
      FROM page p;
END $$;
