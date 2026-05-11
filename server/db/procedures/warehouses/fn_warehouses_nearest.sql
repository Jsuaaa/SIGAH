-- Closest ACTIVE warehouses with available stock to a (lat, lng), ordered by
-- Haversine distance ascending (HU-12). Now that #16 introduced inventory,
-- the SP enforces "with stock > 0" by joining EXISTS on inventory.
--
-- Distance is reported in kilometers (mean Earth radius = 6371 km). Returns
-- an empty result when no warehouse has stock — the API surfaces a clear
-- "no availability" message in that case (HU-12 CA4).
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
        'distance_km',       round(d.distance_km::numeric, 4),
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
       AND EXISTS (
            SELECT 1
              FROM inventory i
             WHERE i.warehouse_id = w.id
               AND i.available_quantity > 0
       )
     ORDER BY d.distance_km ASC, w.id ASC
     LIMIT COALESCE(p_limit, 10);
$$;
