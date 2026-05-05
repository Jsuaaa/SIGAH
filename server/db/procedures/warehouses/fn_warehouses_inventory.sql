-- Inventory rows belonging to a single warehouse, returned as enriched JSONB
-- (same shape as fn_inventory_list rows). Powers GET /warehouses/:id/inventory.

CREATE OR REPLACE FUNCTION fn_warehouses_inventory(p_warehouse_id INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'id',                  i.id,
        'warehouse_id',        i.warehouse_id,
        'resource_type_id',    i.resource_type_id,
        'available_quantity',  i.available_quantity,
        'total_weight_kg',     i.total_weight_kg,
        'batch',               i.batch,
        'expiration_date',     i.expiration_date,
        'is_expired',          (i.expiration_date IS NOT NULL AND i.expiration_date < CURRENT_DATE),
        'created_at',          i.created_at,
        'updated_at',          i.updated_at,
        'resource', jsonb_build_object(
            'id',              r.id,
            'name',            r.name,
            'category',        r.category,
            'unit_of_measure', r.unit_of_measure,
            'unit_weight_kg',  r.unit_weight_kg,
            'is_active',       r.is_active
        )
    ) AS data
      FROM inventory i
      JOIN resource_types r ON r.id = i.resource_type_id
     WHERE i.warehouse_id = p_warehouse_id
     ORDER BY r.category, r.name, i.id;
$$;
