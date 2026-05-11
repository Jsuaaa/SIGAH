-- fn_map_warehouses()
-- Returns a GeoJSON FeatureCollection of all warehouses with geolocation data.
-- Properties include: id, name, address, zone_id, status, max_capacity_kg,
-- current_weight_kg, stock_pct.
-- (RF-09, HU-29 AC1: GeoJSON-compatible format)
CREATE OR REPLACE FUNCTION fn_map_warehouses()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', jsonb_build_object(
            'type', 'Point',
            'coordinates', jsonb_build_array(w.longitude, w.latitude)
          ),
          'properties', jsonb_build_object(
            'id',                w.id,
            'name',              w.name,
            'address',           w.address,
            'zone_id',           w.zone_id,
            'status',            w.status,
            'max_capacity_kg',   w.max_capacity_kg,
            'current_weight_kg', w.current_weight_kg,
            'stock_pct',         CASE
                                   WHEN w.max_capacity_kg > 0
                                   THEN ROUND(((w.current_weight_kg / w.max_capacity_kg) * 100)::numeric, 2)
                                   ELSE NULL
                                 END
          )
        )
      ) FILTER (WHERE w.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM warehouses w;
$$;
