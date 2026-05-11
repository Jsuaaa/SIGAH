-- Paginated donation listing.
--
-- Filters:
--   p_donor_id     : optional donor filter.
--   p_warehouse_id : optional destination warehouse.
--   p_type         : optional donation_type.
--   p_date_from / p_date_to : optional inclusive date range (TIMESTAMPTZ).
--   p_limit, p_offset : pagination.
--
-- Each row is returned as JSONB with the donation columns plus joined donor
-- info and a `details` array (NULL for MONETARY).

CREATE OR REPLACE FUNCTION fn_donations_list(
    p_donor_id     INTEGER,
    p_warehouse_id INTEGER,
    p_type         donation_type,
    p_date_from    TIMESTAMPTZ,
    p_date_to      TIMESTAMPTZ,
    p_limit        INTEGER,
    p_offset       INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT d.*
          FROM donations d
         WHERE (p_donor_id     IS NULL OR d.donor_id                 = p_donor_id)
           AND (p_warehouse_id IS NULL OR d.destination_warehouse_id = p_warehouse_id)
           AND (p_type         IS NULL OR d.donation_type            = p_type)
           AND (p_date_from    IS NULL OR d.date                    >= p_date_from)
           AND (p_date_to      IS NULL OR d.date                    <= p_date_to)
    ),
    page AS (
        SELECT * FROM filtered
         ORDER BY date DESC, id DESC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                to_jsonb(p)
                || jsonb_build_object(
                    'donor', (
                        SELECT to_jsonb(donor) FROM donors donor WHERE donor.id = p.donor_id
                    ),
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
                         WHERE dd.donation_id = p.id
                    ), '[]'::jsonb)
                )
                ORDER BY p.date DESC, p.id DESC
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
