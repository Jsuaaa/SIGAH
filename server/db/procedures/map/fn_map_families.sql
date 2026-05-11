-- fn_map_families()
-- Returns a GeoJSON FeatureCollection of families with geolocation (latitude/longitude NOT NULL).
-- Deliberately OMITS head_document and person names (HU-29 AC2: no personal data).
-- Properties: id, family_code, zone_id, shelter_id, num_members, status, priority_score.
-- (RF-06, HU-29 AC2: family endpoint excludes names and documents)
CREATE OR REPLACE FUNCTION fn_map_families()
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
            'coordinates', jsonb_build_array(f.longitude, f.latitude)
          ),
          'properties', jsonb_build_object(
            'id',             f.id,
            'family_code',    f.family_code,
            'zone_id',        f.zone_id,
            'shelter_id',     f.shelter_id,
            'num_members',    f.num_members,
            'status',         f.status,
            'priority_score', f.priority_score
          )
        )
      ) FILTER (WHERE f.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM families f
  WHERE f.latitude IS NOT NULL
    AND f.longitude IS NOT NULL;
$$;
