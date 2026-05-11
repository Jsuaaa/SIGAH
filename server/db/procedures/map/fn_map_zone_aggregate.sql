-- fn_map_zone_aggregate(p_zone_id INT)
-- Returns a JSON object with all geolocated entities belonging to the given zone:
--   {shelters, warehouses, families, vectors, recent_deliveries}
-- Each sub-collection is a GeoJSON FeatureCollection.
-- recent_deliveries defaults to last 7 days with geolocation.
-- (HU-29 AC3: zone endpoint aggregates all entities)
CREATE OR REPLACE FUNCTION fn_map_zone_aggregate(p_zone_id INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_zone_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM zones WHERE id = p_zone_id) INTO v_zone_exists;
  IF NOT v_zone_exists THEN
    RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
  END IF;

  RETURN jsonb_build_object(
    'zone_id', p_zone_id,

    'shelters', (
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
      FROM shelters s
      WHERE s.zone_id = p_zone_id
    ),

    'warehouses', (
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
      FROM warehouses w
      WHERE w.zone_id = p_zone_id
    ),

    'families', (
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
      WHERE f.zone_id = p_zone_id
        AND f.latitude IS NOT NULL
        AND f.longitude IS NOT NULL
    ),

    'vectors', (
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
                'shelter_id',    hv.shelter_id,
                'reported_date', hv.reported_date
              )
            )
          ) FILTER (WHERE hv.id IS NOT NULL),
          '[]'::jsonb
        )
      )
      FROM health_vectors hv
      WHERE hv.zone_id = p_zone_id
        AND hv.latitude IS NOT NULL
        AND hv.longitude IS NOT NULL
    ),

    'recent_deliveries', (
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
      JOIN families f ON d.family_id = f.id
      WHERE f.zone_id = p_zone_id
        AND d.delivery_latitude IS NOT NULL
        AND d.delivery_longitude IS NOT NULL
        AND d.delivery_date >= (NOW() - INTERVAL '7 days')
    )
  );
END;
$$;
