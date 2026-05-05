-- Aggregate inventory by warehouse + category. Returns one row per (warehouse,
-- category) pair with totals (quantity and kilograms). Used by the dashboard
-- (HU-15 CA1) and the reports module (#29).
--
-- Filters:
--   p_warehouse_id : optional, restricts the aggregation.

CREATE OR REPLACE FUNCTION fn_inventory_summary(p_warehouse_id INTEGER)
RETURNS TABLE (
    warehouse_id     INTEGER,
    warehouse_name   TEXT,
    category         resource_category,
    total_quantity   BIGINT,
    total_weight_kg  DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT w.id,
           w.name,
           r.category,
           COALESCE(SUM(i.available_quantity), 0)::BIGINT,
           COALESCE(SUM(i.total_weight_kg),    0)
      FROM warehouses w
      LEFT JOIN inventory i      ON i.warehouse_id = w.id
      LEFT JOIN resource_types r ON r.id = i.resource_type_id
     WHERE (p_warehouse_id IS NULL OR w.id = p_warehouse_id)
     GROUP BY w.id, w.name, r.category
     ORDER BY w.name ASC, r.category ASC NULLS LAST;
$$;
