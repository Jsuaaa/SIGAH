-- Warehouses that belong to a zone. Returns the full warehouse row plus the
-- derived occupancy fields (is_over_85_percent, occupancy_ratio) so the API
-- can render the >85% alert without an extra round-trip (HU-11 CA3).

CREATE OR REPLACE FUNCTION fn_zones_warehouses(p_zone_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(w) || jsonb_build_object(
        'is_over_85_percent', (w.current_weight_kg / NULLIF(w.max_capacity_kg, 0)) > 0.85,
        'occupancy_ratio',    ROUND((w.current_weight_kg / NULLIF(w.max_capacity_kg, 0))::numeric, 4)
    ) AS data
      FROM warehouses w
     WHERE w.zone_id = p_zone_id
     ORDER BY w.id ASC;
$$;
