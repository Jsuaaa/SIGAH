-- fn_reports_inventory(p_warehouse_id, p_category)
--
-- Returns aggregated inventory by warehouse and resource category (Issue #28 / HU-28 CA2).
-- Both filters are optional (NULL = no filter).
--
-- Reuses the same join pattern as fn_inventory_summary but adds an optional
-- p_category filter so the reports endpoint can drill down further.

CREATE OR REPLACE FUNCTION fn_reports_inventory(
    p_warehouse_id INTEGER,
    p_category     resource_category
)
RETURNS TABLE (
    warehouse_id     INTEGER,
    warehouse_name   TEXT,
    category         resource_category,
    total_quantity   BIGINT,
    total_weight_kg  DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT
        w.id                                            AS warehouse_id,
        w.name                                          AS warehouse_name,
        r.category                                      AS category,
        COALESCE(SUM(i.available_quantity), 0)::BIGINT  AS total_quantity,
        COALESCE(SUM(i.total_weight_kg),    0)          AS total_weight_kg
      FROM warehouses w
      LEFT JOIN inventory i      ON i.warehouse_id      = w.id
      LEFT JOIN resource_types r ON r.id                = i.resource_type_id
     WHERE (p_warehouse_id IS NULL OR w.id        = p_warehouse_id)
       AND (p_category     IS NULL OR r.category  = p_category)
     GROUP BY w.id, w.name, r.category
     ORDER BY w.name ASC, r.category ASC NULLS LAST;
$$;
