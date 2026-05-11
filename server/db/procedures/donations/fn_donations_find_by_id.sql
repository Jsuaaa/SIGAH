-- Find a donation by id, enriched with donor and details. Returns no rows
-- when the donation does not exist (the service layer surfaces SH404).

CREATE OR REPLACE FUNCTION fn_donations_find_by_id(p_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(d)
        || jsonb_build_object(
            'donor', (SELECT to_jsonb(donor) FROM donors donor WHERE donor.id = d.donor_id),
            'details', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',               dd.id,
                        'resource_type_id', dd.resource_type_id,
                        'resource_name',    rt.name,
                        'category',         rt.category,
                        'quantity',         dd.quantity,
                        'weight_kg',        dd.weight_kg,
                        'batch',            dd.batch,
                        'expiration_date',  dd.expiration_date
                    )
                    ORDER BY dd.id
                )
                  FROM donation_details dd
                  JOIN resource_types rt ON rt.id = dd.resource_type_id
                 WHERE dd.donation_id = d.id
            ), '[]'::jsonb)
        ) AS data
      FROM donations d
     WHERE d.id = p_id
     LIMIT 1;
$$;
