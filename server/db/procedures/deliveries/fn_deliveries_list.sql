-- Paginated delivery listing.
--
-- Each row is JSONB with the delivery columns plus joined family/warehouse
-- snapshots and the details array. Until #23/#24 land the creation SP, the
-- only way to populate this table is direct SQL — but the read path stays
-- valid throughout.
--
-- Filters:
--   p_family_id     : optional.
--   p_warehouse_id  : optional source_warehouse_id.
--   p_status        : optional delivery_status.
--   p_date_from / p_date_to : optional inclusive range on delivery_date.
--   p_limit, p_offset : pagination.

CREATE OR REPLACE FUNCTION fn_deliveries_list(
    p_family_id    INTEGER,
    p_warehouse_id INTEGER,
    p_status       delivery_status,
    p_date_from    TIMESTAMPTZ,
    p_date_to      TIMESTAMPTZ,
    p_limit        INTEGER,
    p_offset       INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT d.*
          FROM deliveries d
         WHERE (p_family_id    IS NULL OR d.family_id           = p_family_id)
           AND (p_warehouse_id IS NULL OR d.source_warehouse_id = p_warehouse_id)
           AND (p_status       IS NULL OR d.status              = p_status)
           AND (p_date_from    IS NULL OR d.delivery_date      >= p_date_from)
           AND (p_date_to      IS NULL OR d.delivery_date      <= p_date_to)
    ),
    page AS (
        SELECT * FROM filtered
         ORDER BY delivery_date DESC, id DESC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                to_jsonb(p) || jsonb_build_object(
                    'family',    (SELECT to_jsonb(f) FROM families f WHERE f.id = p.family_id),
                    'warehouse', (SELECT to_jsonb(w) FROM warehouses w WHERE w.id = p.source_warehouse_id),
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
                         WHERE dd.delivery_id = p.id
                    ), '[]'::jsonb)
                )
                ORDER BY p.delivery_date DESC, p.id DESC
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
