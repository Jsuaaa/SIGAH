-- Consume `p_quantity` units of (warehouse, resource_type) from inventory and
-- update the warehouse's current_weight_kg accordingly. Used by the delivery
-- creation flow (#23 exception, #24 regular).
--
-- Strategy: FIFO by expiration_date (NULLs last). The SP iterates over the
-- batches that match (warehouse_id, resource_type_id) and decrements them
-- in order until p_quantity is satisfied.
--
-- Raises:
--   SH404 if no inventory rows exist for the (warehouse, resource_type).
--   SH422 if total available stock is less than p_quantity.
--
-- Returns the total weight (kg) deducted from the warehouse.

CREATE OR REPLACE FUNCTION sp_inventory_consume(
    p_warehouse_id     INTEGER,
    p_resource_type_id INTEGER,
    p_quantity         INTEGER
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql AS $$
DECLARE
    v_total_available  INTEGER := 0;
    v_unit_weight      DOUBLE PRECISION;
    v_remaining        INTEGER := p_quantity;
    v_weight_deducted  DOUBLE PRECISION := 0;
    v_row              inventory;
    v_take             INTEGER;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be > 0' USING ERRCODE = 'SH422';
    END IF;

    SELECT COALESCE(SUM(available_quantity), 0)
      INTO v_total_available
      FROM inventory
     WHERE warehouse_id     = p_warehouse_id
       AND resource_type_id = p_resource_type_id;

    IF v_total_available = 0 THEN
        RAISE EXCEPTION 'No inventory for resource in warehouse'
            USING ERRCODE = 'SH404';
    END IF;
    IF v_total_available < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock to consume requested quantity'
            USING ERRCODE = 'SH422';
    END IF;

    SELECT unit_weight_kg INTO v_unit_weight
      FROM resource_types WHERE id = p_resource_type_id;

    -- Iterate batches FIFO by expiration_date (NULLs last so dated lots are
    -- consumed first). Lock each row to serialize concurrent deliveries
    -- against the same batch.
    FOR v_row IN
        SELECT *
          FROM inventory
         WHERE warehouse_id     = p_warehouse_id
           AND resource_type_id = p_resource_type_id
           AND available_quantity > 0
         ORDER BY expiration_date NULLS LAST, id ASC
         FOR UPDATE
    LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_row.available_quantity, v_remaining);

        UPDATE inventory
           SET available_quantity = available_quantity - v_take,
               total_weight_kg    = GREATEST(total_weight_kg - (v_take * v_unit_weight), 0)
         WHERE id = v_row.id;

        v_remaining       := v_remaining - v_take;
        v_weight_deducted := v_weight_deducted + (v_take * v_unit_weight);
    END LOOP;

    UPDATE warehouses
       SET current_weight_kg = GREATEST(current_weight_kg - v_weight_deducted, 0)
     WHERE id = p_warehouse_id;

    RETURN v_weight_deducted;
END $$;
