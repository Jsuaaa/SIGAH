-- Find a shelter by primary key. Returns the row enriched with derived
-- occupancy fields (is_over_capacity, occupancy_ratio). Empty result if the
-- shelter does not exist.

CREATE OR REPLACE FUNCTION fn_shelters_find_by_id(p_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(s) || jsonb_build_object(
        'is_over_capacity', (s.current_occupancy::numeric / NULLIF(s.max_capacity, 0)) > 0.9,
        'occupancy_ratio',  ROUND((s.current_occupancy::numeric / NULLIF(s.max_capacity, 0))::numeric, 4)
    ) AS data
      FROM shelters s
     WHERE s.id = p_id
     LIMIT 1;
$$;
