-- Find a delivery by id, enriched with family/warehouse and details.

CREATE OR REPLACE FUNCTION fn_deliveries_find_by_id(p_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(d) || jsonb_build_object(
        'family',    (SELECT to_jsonb(f) FROM families f WHERE f.id = d.family_id),
        'warehouse', (SELECT to_jsonb(w) FROM warehouses w WHERE w.id = d.source_warehouse_id),
        'details',   COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',               dd.id,
                    'resource_type_id', dd.resource_type_id,
                    'resource_name',    rt.name,
                    'category',         rt.category,
                    'quantity',         dd.quantity,
                    'weight_kg',        dd.weight_kg,
                    'batch',            dd.batch
                )
                ORDER BY dd.id
            )
              FROM delivery_details dd
              JOIN resource_types rt ON rt.id = dd.resource_type_id
             WHERE dd.delivery_id = d.id
        ), '[]'::jsonb)
    ) AS data
      FROM deliveries d
     WHERE d.id = p_id
     LIMIT 1;
$$;
