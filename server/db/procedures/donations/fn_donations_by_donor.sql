-- Historical donations for a donor, ordered by date DESC (HU-20 CA1).
-- Returns the same enriched JSONB shape as fn_donations_find_by_id.
-- SH404 if the donor does not exist so the API can differentiate "donor with
-- no donations" from "donor not found".

CREATE OR REPLACE FUNCTION fn_donations_by_donor(p_donor_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM donors WHERE id = p_donor_id) THEN
        RAISE EXCEPTION 'Donor not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN QUERY
        SELECT to_jsonb(d)
            || jsonb_build_object(
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
         WHERE d.donor_id = p_donor_id
         ORDER BY d.date DESC, d.id DESC;
END $$;
