-- fn_map_shelters()
-- Returns a GeoJSON FeatureCollection of all shelters with geolocation data.
-- Properties include: id, name, address, zone_id, type, max_capacity,
-- current_occupancy, occupancy_pct.
-- (RF-05, HU-29 AC1: GeoJSON-compatible format)
CREATE OR REPLACE FUNCTION fn_map_shelters()
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
            'coordinates', jsonb_build_array(s.longitude, s.latitude)
          ),
          'properties', jsonb_build_object(
            'id',                s.id,
            'name',              s.name,
            'address',           s.address,
            'zone_id',           s.zone_id,
            'type',              s.type,
            'max_capacity',      s.max_capacity,
            'current_occupancy', s.current_occupancy,
            'occupancy_pct',     CASE
                                   WHEN s.max_capacity > 0
                                   THEN ROUND((s.current_occupancy::numeric / s.max_capacity) * 100, 2)
                                   ELSE NULL
                                 END
          )
        )
      ) FILTER (WHERE s.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM shelters s;
$$;
