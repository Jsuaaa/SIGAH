-- fn_map_recent_deliveries(p_days INT)
-- Returns a GeoJSON FeatureCollection of deliveries with geolocation created in the
-- last p_days days (default: 7). Only deliveries with delivery_latitude/longitude NOT NULL
-- are included.
-- Properties: id, delivery_code, family_id, source_warehouse_id, status, delivery_date,
-- coverage_days.
-- (HU-29 AC4: recent deliveries filtered to N days)
CREATE OR REPLACE FUNCTION fn_map_recent_deliveries(p_days INT DEFAULT 7)
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
            'coordinates', jsonb_build_array(d.delivery_longitude, d.delivery_latitude)
          ),
          'properties', jsonb_build_object(
            'id',                   d.id,
            'delivery_code',        d.delivery_code,
            'family_id',            d.family_id,
            'source_warehouse_id',  d.source_warehouse_id,
            'status',               d.status,
            'delivery_date',        d.delivery_date,
            'coverage_days',        d.coverage_days
          )
        )
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM deliveries d
  WHERE d.delivery_latitude IS NOT NULL
    AND d.delivery_longitude IS NOT NULL
    AND d.delivery_date >= (NOW() - (p_days || ' days')::interval);
$$;
