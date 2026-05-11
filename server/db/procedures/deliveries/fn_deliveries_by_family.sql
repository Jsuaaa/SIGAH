-- Historical deliveries for a family, ordered by delivery_date DESC.
-- Used by GET /families/:id/deliveries (planned in #23+).

CREATE OR REPLACE FUNCTION fn_deliveries_by_family(p_family_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN QUERY
        SELECT to_jsonb(d) || jsonb_build_object(
            'details', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',               dd.id,
                        'resource_type_id', dd.resource_type_id,
                        'resource_name',    rt.name,
                        'category',         rt.category,
                        'quantity',         dd.quantity,
                        'weight_kg',        dd.weight_kg
                    )
                    ORDER BY dd.id
                )
                  FROM delivery_details dd
                  JOIN resource_types rt ON rt.id = dd.resource_type_id
                 WHERE dd.delivery_id = d.id
            ), '[]'::jsonb)
        ) AS data
          FROM deliveries d
         WHERE d.family_id = p_family_id
         ORDER BY d.delivery_date DESC, d.id DESC;
END $$;
