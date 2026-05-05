-- Upsert an inventory row by (warehouse_id, resource_type_id, batch) and add
-- the supplied quantity to the existing available_quantity (or create the
-- row at that quantity if it doesn't exist yet).
--
-- This is the entry point used by donation reception (#19) and by admin
-- tooling that needs to seed initial stock. It runs in one transaction:
--   - upsert inventory row + adjust total_weight_kg.
--   - update warehouses.current_weight_kg, enforcing RN-03 (SH422 if
--     max_capacity_kg would be exceeded).
--
-- For ad-hoc corrections (e.g. counting mistakes), callers must use
-- sp_inventory_adjust which writes the audit trail in inventory_adjustments.

CREATE OR REPLACE FUNCTION sp_inventory_upsert(
    p_warehouse_id      INTEGER,
    p_resource_type_id  INTEGER,
    p_quantity          INTEGER,
    p_batch             TEXT,
    p_expiration_date   DATE
)
RETURNS inventory
LANGUAGE plpgsql AS $$
DECLARE
    v_unit_weight   DOUBLE PRECISION;
    v_weight_delta  DOUBLE PRECISION;
    v_warehouse     warehouses;
    v_inventory     inventory;
    v_batch         TEXT := COALESCE(NULLIF(p_batch, ''), 'DEFAULT');
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be > 0' USING ERRCODE = 'SH422';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_warehouse_id) THEN
        RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'SH404';
    END IF;

    SELECT unit_weight_kg INTO v_unit_weight
      FROM resource_types
     WHERE id = p_resource_type_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
    END IF;

    v_weight_delta := p_quantity * v_unit_weight;

    SELECT * INTO v_warehouse FROM warehouses WHERE id = p_warehouse_id FOR UPDATE;
    IF v_warehouse.current_weight_kg + v_weight_delta > v_warehouse.max_capacity_kg THEN
        RAISE EXCEPTION 'Upsert would exceed warehouse max_capacity_kg (RN-03)'
            USING ERRCODE = 'SH422';
    END IF;

    INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg, batch, expiration_date)
    VALUES (p_warehouse_id, p_resource_type_id, p_quantity, v_weight_delta, v_batch, p_expiration_date)
    ON CONFLICT (warehouse_id, resource_type_id, batch)
    DO UPDATE SET
        available_quantity = inventory.available_quantity + EXCLUDED.available_quantity,
        total_weight_kg    = inventory.total_weight_kg    + EXCLUDED.total_weight_kg,
        expiration_date    = COALESCE(EXCLUDED.expiration_date, inventory.expiration_date)
    RETURNING * INTO v_inventory;

    UPDATE warehouses
       SET current_weight_kg = current_weight_kg + v_weight_delta
     WHERE id = p_warehouse_id;

    RETURN v_inventory;
END $$;
