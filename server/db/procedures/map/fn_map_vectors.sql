-- fn_map_vectors()
-- Returns a GeoJSON FeatureCollection of health vectors with geolocation (lat/lon NOT NULL).
-- Properties: id, vector_type, risk_level, status, zone_id, shelter_id, reported_date.
-- (HU-25, HU-29 AC1: GeoJSON-compatible format)
CREATE OR REPLACE FUNCTION fn_map_vectors()
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
            'coordinates', jsonb_build_array(hv.longitude, hv.latitude)
          ),
          'properties', jsonb_build_object(
            'id',            hv.id,
            'vector_type',   hv.vector_type,
            'risk_level',    hv.risk_level,
            'status',        hv.status,
            'zone_id',       hv.zone_id,
            'shelter_id',    hv.shelter_id,
            'reported_date', hv.reported_date
          )
        )
      ) FILTER (WHERE hv.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM health_vectors hv
  WHERE hv.latitude IS NOT NULL
    AND hv.longitude IS NOT NULL;
$$;
