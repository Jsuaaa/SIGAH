-- Find a warehouse by primary key. Returns the row enriched with the same
-- derived fields as fn_warehouses_list (is_over_85_percent, occupancy_ratio).

CREATE OR REPLACE FUNCTION fn_warehouses_find_by_id(p_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(w) || jsonb_build_object(
        'is_over_85_percent', (w.current_weight_kg / NULLIF(w.max_capacity_kg, 0)) > 0.85,
        'occupancy_ratio',    ROUND((w.current_weight_kg / NULLIF(w.max_capacity_kg, 0))::numeric, 4)
    ) AS data
      FROM warehouses w
     WHERE w.id = p_id
     LIMIT 1;
$$;
