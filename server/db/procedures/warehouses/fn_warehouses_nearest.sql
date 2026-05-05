-- Closest ACTIVE warehouses to a given (lat, lng) by Haversine distance,
-- ordered ascending. The "with stock" filter requested by HU-11 lands once
-- #16 (inventory) introduces the linkage table — until then we return every
-- ACTIVE warehouse and rely on the caller to verify stock.
--
-- Distance is reported in kilometers. Mean Earth radius = 6371 km.
--
-- Inputs:
--   p_latitude  : reference latitude (-90..90).
--   p_longitude : reference longitude (-180..180).
--   p_limit     : how many warehouses to return (NULL → 10).

CREATE OR REPLACE FUNCTION fn_warehouses_nearest(
    p_latitude  DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_limit     INTEGER
)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(w) || jsonb_build_object(
        'distance_km', round(d.distance_km::numeric, 4),
        'is_over_85_percent', (w.current_weight_kg / NULLIF(w.max_capacity_kg, 0)) > 0.85,
        'occupancy_ratio',    ROUND((w.current_weight_kg / NULLIF(w.max_capacity_kg, 0))::numeric, 4)
    ) AS data
      FROM warehouses w
      JOIN LATERAL (
          SELECT 6371 * 2 * asin(sqrt(
              power(sin(radians(w.latitude  - p_latitude)  / 2), 2)
            + cos(radians(p_latitude))  * cos(radians(w.latitude))
            * power(sin(radians(w.longitude - p_longitude) / 2), 2)
          )) AS distance_km
      ) AS d ON TRUE
     WHERE w.status = 'ACTIVE'
     ORDER BY d.distance_km ASC, w.id ASC
     LIMIT COALESCE(p_limit, 10);
$$;
