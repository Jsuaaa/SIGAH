-- fn_health_vectors_list
-- Listado paginado con filtros por zone, shelter, risk_level, vector_type, status.
-- Incluye snapshot de zona y refugio en el JSONB retornado.

CREATE OR REPLACE FUNCTION fn_health_vectors_list(
    p_zone_id      INTEGER,
    p_shelter_id   INTEGER,
    p_risk_level   risk_level,
    p_vector_type  vector_type,
    p_status       health_vector_status,
    p_limit        INTEGER,
    p_offset       INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT hv.*
          FROM health_vectors hv
         WHERE (p_zone_id     IS NULL OR hv.zone_id     = p_zone_id)
           AND (p_shelter_id  IS NULL OR hv.shelter_id  = p_shelter_id)
           AND (p_risk_level  IS NULL OR hv.risk_level  = p_risk_level)
           AND (p_vector_type IS NULL OR hv.vector_type = p_vector_type)
           AND (p_status      IS NULL OR hv.status      = p_status)
    ),
    page AS (
        SELECT hv.*,
               to_jsonb(z) AS zone_snapshot,
               to_jsonb(s) AS shelter_snapshot
          FROM filtered hv
          LEFT JOIN zones    z ON z.id = hv.zone_id
          LEFT JOIN shelters s ON s.id = hv.shelter_id
         ORDER BY hv.reported_date DESC, hv.id DESC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                to_jsonb(p) - 'zone_snapshot' - 'shelter_snapshot'
                || jsonb_build_object(
                    'zone',    p.zone_snapshot,
                    'shelter', p.shelter_snapshot
                )
                ORDER BY p.reported_date DESC, p.id DESC
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
