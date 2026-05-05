-- Paginated inventory listing.
--
-- Each row is returned as JSONB with the inventory columns plus the joined
-- resource_type details (name, category, unit_of_measure, unit_weight_kg)
-- and a summary `is_expired` flag so the API can highlight expired batches
-- without an extra round-trip.
--
-- Filters:
--   p_warehouse_id     : optional.
--   p_resource_type_id : optional.
--   p_category         : optional resource_category filter.
--   p_only_in_stock    : NULL → all; TRUE → only available_quantity > 0.
--   p_limit, p_offset  : pagination.

CREATE OR REPLACE FUNCTION fn_inventory_list(
    p_warehouse_id     INTEGER,
    p_resource_type_id INTEGER,
    p_category         resource_category,
    p_only_in_stock    BOOLEAN,
    p_limit            INTEGER,
    p_offset           INTEGER
)
RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT i.*,
               r.name            AS resource_name,
               r.category        AS resource_category,
               r.unit_of_measure AS resource_unit_of_measure,
               r.unit_weight_kg  AS resource_unit_weight_kg,
               r.is_active       AS resource_is_active
          FROM inventory i
          JOIN resource_types r ON r.id = i.resource_type_id
         WHERE (p_warehouse_id     IS NULL OR i.warehouse_id     = p_warehouse_id)
           AND (p_resource_type_id IS NULL OR i.resource_type_id = p_resource_type_id)
           AND (p_category         IS NULL OR r.category         = p_category)
           AND (p_only_in_stock    IS NULL OR (p_only_in_stock = FALSE) OR i.available_quantity > 0)
    ),
    page AS (
        SELECT * FROM filtered
         ORDER BY warehouse_id, resource_category, resource_name, id
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id',                  p.id,
                    'warehouse_id',        p.warehouse_id,
                    'resource_type_id',    p.resource_type_id,
                    'available_quantity',  p.available_quantity,
                    'total_weight_kg',     p.total_weight_kg,
                    'batch',               p.batch,
                    'expiration_date',     p.expiration_date,
                    'is_expired',          (p.expiration_date IS NOT NULL AND p.expiration_date < CURRENT_DATE),
                    'created_at',          p.created_at,
                    'updated_at',          p.updated_at,
                    'resource', jsonb_build_object(
                        'id',              p.resource_type_id,
                        'name',            p.resource_name,
                        'category',        p.resource_category,
                        'unit_of_measure', p.resource_unit_of_measure,
                        'unit_weight_kg',  p.resource_unit_weight_kg,
                        'is_active',       p.resource_is_active
                    )
                )
                ORDER BY p.warehouse_id, p.resource_category, p.resource_name, p.id
            ),
            '[]'::jsonb
        ) AS data,
        (SELECT count(*) FROM filtered) AS total
      FROM page p;
$$;
