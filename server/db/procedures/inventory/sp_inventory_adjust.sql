-- Atomically adjust inventory quantity (HU-17, RN-03).
--
-- Single transaction:
--   1. Lock the inventory row (FOR UPDATE).
--   2. Validate available_quantity + delta >= 0 (HU-17 CA3 → SH422).
--   3. Update inventory.available_quantity and inventory.total_weight_kg
--      (delta * unit_weight_kg of the resource type).
--   4. Update warehouses.current_weight_kg by the same weight delta. The
--      warehouses table CHECK enforces RN-03; if the increment would push
--      current_weight_kg above max_capacity_kg, the SP raises SH422 with a
--      clear message instead of letting the generic check_violation bubble.
--   5. Insert one row in inventory_adjustments capturing reason, note and
--      user (audit trail). The future audit hook (#28) will mirror this in
--      audit_logs.
--
-- All four side effects share one DB transaction. If any step fails the
-- whole call rolls back, so inventory and warehouse weight never diverge.
--
-- Inputs:
--   p_inventory_id : the inventory row to adjust.
--   p_delta        : positive (add stock) or negative (remove stock) integer.
--   p_reason       : enum value (MERMA/DANO/DEVOLUCION/CORRECCION).
--   p_reason_note  : non-empty free-text justification (HU-17 CA1-2).
--   p_user_id      : user attribution.
--
-- Returns the updated inventory row.

CREATE OR REPLACE FUNCTION sp_inventory_adjust(
    p_inventory_id INTEGER,
    p_delta        INTEGER,
    p_reason       adjustment_reason,
    p_reason_note  TEXT,
    p_user_id      INTEGER
)
RETURNS inventory
LANGUAGE plpgsql AS $$
DECLARE
    v_inventory   inventory;
    v_unit_weight DOUBLE PRECISION;
    v_weight_delta DOUBLE PRECISION;
    v_warehouse   warehouses;
BEGIN
    IF p_delta IS NULL OR p_delta = 0 THEN
        RAISE EXCEPTION 'delta must be a non-zero integer' USING ERRCODE = 'SH422';
    END IF;

    IF p_reason_note IS NULL OR length(trim(p_reason_note)) = 0 THEN
        RAISE EXCEPTION 'reason_note is required (HU-17 CA1)' USING ERRCODE = 'SH422';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;

    -- Lock the inventory row to serialize concurrent adjustments on the same
    -- batch. The same lock makes the warehouse weight read below consistent
    -- with the update we are about to perform.
    SELECT * INTO v_inventory FROM inventory WHERE id = p_inventory_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory row not found' USING ERRCODE = 'SH404';
    END IF;

    -- HU-17 CA3: never let stock go negative.
    IF v_inventory.available_quantity + p_delta < 0 THEN
        RAISE EXCEPTION 'Adjustment would leave stock below zero (HU-17 CA3)'
            USING ERRCODE = 'SH422';
    END IF;

    SELECT unit_weight_kg INTO v_unit_weight
      FROM resource_types
     WHERE id = v_inventory.resource_type_id;
    -- (resource_type FK is RESTRICT so the row always exists)

    v_weight_delta := p_delta * v_unit_weight;

    -- Pre-check RN-03 against the warehouse so we can surface a friendly
    -- error before the table CHECK fires. A FOR UPDATE on the warehouse row
    -- guards against concurrent adjustments on different inventory rows of
    -- the same warehouse.
    SELECT * INTO v_warehouse
      FROM warehouses WHERE id = v_inventory.warehouse_id FOR UPDATE;

    IF v_warehouse.current_weight_kg + v_weight_delta > v_warehouse.max_capacity_kg THEN
        RAISE EXCEPTION 'Adjustment would exceed warehouse max_capacity_kg (RN-03)'
            USING ERRCODE = 'SH422';
    END IF;

    UPDATE inventory
       SET available_quantity = available_quantity + p_delta,
           total_weight_kg    = GREATEST(total_weight_kg + v_weight_delta, 0)
     WHERE id = p_inventory_id
    RETURNING * INTO v_inventory;

    UPDATE warehouses
       SET current_weight_kg = current_weight_kg + v_weight_delta
     WHERE id = v_inventory.warehouse_id;

    INSERT INTO inventory_adjustments (inventory_id, delta, reason, reason_note, user_id)
    VALUES (p_inventory_id, p_delta, p_reason, p_reason_note, p_user_id);

    RETURN v_inventory;
END $$;
