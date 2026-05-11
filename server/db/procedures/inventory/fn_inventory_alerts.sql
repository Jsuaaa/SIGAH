-- Aggregate inventory alerts in one round-trip (HU-15, HU-16).
--
-- Returns one row per alert with `kind`, `severity`, supporting metadata and
-- a `link` field pointing the UI at the relevant warehouse.
--
-- Alert kinds:
--   LOW_STOCK         : inventory.available_quantity < threshold (configured
--                       in alert_thresholds, default 10).
--   EXPIRING_SOON     : expiration_date within the next 7 days.
--   EXPIRED           : expiration_date already past.
--   WAREHOUSE_OVER_85 : warehouses.current_weight_kg / max_capacity_kg > 0.85.
--
-- Severity:
--   CRITICAL : EXPIRED, WAREHOUSE_OVER_85 with ratio > 0.95, LOW_STOCK = 0.
--   HIGH     : WAREHOUSE_OVER_85 (0.85..0.95], LOW_STOCK <= half threshold,
--              EXPIRING_SOON within 3 days.
--   MEDIUM   : everything else.

CREATE OR REPLACE FUNCTION fn_inventory_alerts()
RETURNS TABLE (
    kind       TEXT,
    severity   TEXT,
    message    TEXT,
    link       TEXT,
    metadata   JSONB
)
LANGUAGE sql STABLE AS $$
    -- Default threshold for resource_types without an explicit row.
    WITH default_threshold AS (SELECT 10 AS min_qty),
         low_stock AS (
        SELECT
            'LOW_STOCK'::TEXT AS kind,
            CASE
                WHEN i.available_quantity = 0                                THEN 'CRITICAL'
                WHEN i.available_quantity <= COALESCE(t.min_quantity, dt.min_qty) / 2.0 THEN 'HIGH'
                ELSE 'MEDIUM'
            END AS severity,
            'Stock bajo: ' || r.name || ' en ' || w.name
              || ' (' || i.available_quantity || ' ' || r.unit_of_measure || ')' AS message,
            '/warehouses/' || w.id::TEXT AS link,
            jsonb_build_object(
                'inventory_id',       i.id,
                'warehouse_id',       w.id,
                'warehouse_name',     w.name,
                'resource_type_id',   r.id,
                'resource_name',      r.name,
                'category',           r.category,
                'available_quantity', i.available_quantity,
                'threshold',          COALESCE(t.min_quantity, dt.min_qty)
            ) AS metadata
          FROM inventory i
          JOIN resource_types r ON r.id = i.resource_type_id
          JOIN warehouses w     ON w.id = i.warehouse_id
          CROSS JOIN default_threshold dt
          LEFT JOIN alert_thresholds t ON t.resource_type_id = r.id
         WHERE r.is_active = TRUE
           AND i.available_quantity < COALESCE(t.min_quantity, dt.min_qty)
    ),
    expired AS (
        SELECT
            'EXPIRED'::TEXT AS kind,
            'CRITICAL'::TEXT AS severity,
            'Lote vencido: ' || r.name || ' (lote ' || i.batch || ') en ' || w.name AS message,
            '/warehouses/' || w.id::TEXT AS link,
            jsonb_build_object(
                'inventory_id',     i.id,
                'warehouse_id',     w.id,
                'warehouse_name',   w.name,
                'resource_type_id', r.id,
                'resource_name',    r.name,
                'batch',            i.batch,
                'expiration_date',  i.expiration_date
            ) AS metadata
          FROM inventory i
          JOIN resource_types r ON r.id = i.resource_type_id
          JOIN warehouses w     ON w.id = i.warehouse_id
         WHERE i.expiration_date IS NOT NULL
           AND i.expiration_date < CURRENT_DATE
    ),
    expiring_soon AS (
        SELECT
            'EXPIRING_SOON'::TEXT AS kind,
            CASE WHEN (i.expiration_date - CURRENT_DATE) <= 3
                 THEN 'HIGH' ELSE 'MEDIUM' END AS severity,
            'Lote por vencer en ' || (i.expiration_date - CURRENT_DATE)::TEXT
              || ' días: ' || r.name || ' (lote ' || i.batch || ') en ' || w.name AS message,
            '/warehouses/' || w.id::TEXT AS link,
            jsonb_build_object(
                'inventory_id',     i.id,
                'warehouse_id',     w.id,
                'warehouse_name',   w.name,
                'resource_type_id', r.id,
                'resource_name',    r.name,
                'batch',            i.batch,
                'expiration_date',  i.expiration_date,
                'days_remaining',   (i.expiration_date - CURRENT_DATE)
            ) AS metadata
          FROM inventory i
          JOIN resource_types r ON r.id = i.resource_type_id
          JOIN warehouses w     ON w.id = i.warehouse_id
         WHERE i.expiration_date IS NOT NULL
           AND i.expiration_date >= CURRENT_DATE
           AND i.expiration_date <= CURRENT_DATE + INTERVAL '7 days'
    ),
    warehouse_full AS (
        SELECT
            'WAREHOUSE_OVER_85'::TEXT AS kind,
            CASE WHEN w.current_weight_kg / NULLIF(w.max_capacity_kg, 0) > 0.95
                 THEN 'CRITICAL' ELSE 'HIGH' END AS severity,
            'Bodega ' || w.name || ' al '
              || ROUND((w.current_weight_kg / NULLIF(w.max_capacity_kg, 0) * 100)::numeric, 1)::TEXT
              || '% de capacidad' AS message,
            '/warehouses/' || w.id::TEXT AS link,
            jsonb_build_object(
                'warehouse_id',       w.id,
                'warehouse_name',     w.name,
                'current_weight_kg',  w.current_weight_kg,
                'max_capacity_kg',    w.max_capacity_kg,
                'occupancy_ratio',    ROUND((w.current_weight_kg / NULLIF(w.max_capacity_kg, 0))::numeric, 4)
            ) AS metadata
          FROM warehouses w
         WHERE w.max_capacity_kg > 0
           AND w.current_weight_kg / w.max_capacity_kg > 0.85
    )
    SELECT * FROM (
        SELECT * FROM low_stock
        UNION ALL SELECT * FROM expired
        UNION ALL SELECT * FROM expiring_soon
        UNION ALL SELECT * FROM warehouse_full
    ) all_alerts
    ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
        kind;
$$;
