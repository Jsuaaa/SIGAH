-- Families that belong to a zone. Returns the full family row as JSONB so the
-- API can render priority breakdowns and status without an extra round-trip.

CREATE OR REPLACE FUNCTION fn_zones_families(p_zone_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(f) AS data
      FROM families f
     WHERE f.zone_id = p_zone_id
     ORDER BY f.priority_score DESC, f.id ASC;
$$;
