-- Partial update of a warehouse. NULL parameters are ignored. Raises:
--   SH404 if the warehouse or referenced zone does not exist.
--   SH409 on duplicate name.
--   SH422 if the resulting current_weight_kg > max_capacity_kg (RN-03).

CREATE OR REPLACE FUNCTION fn_warehouses_update(
    p_id                INTEGER,
    p_name              TEXT,
    p_address           TEXT,
    p_zone_id           INTEGER,
    p_max_capacity_kg   DOUBLE PRECISION,
    p_current_weight_kg DOUBLE PRECISION,
    p_status            warehouse_status,
    p_latitude          DOUBLE PRECISION,
    p_longitude         DOUBLE PRECISION
)
RETURNS warehouses
LANGUAGE plpgsql AS $$
DECLARE
    v_warehouse warehouses;
BEGIN
    BEGIN
        UPDATE warehouses
           SET name              = COALESCE(p_name,              name),
               address           = COALESCE(p_address,           address),
               zone_id           = COALESCE(p_zone_id,           zone_id),
               max_capacity_kg   = COALESCE(p_max_capacity_kg,   max_capacity_kg),
               current_weight_kg = COALESCE(p_current_weight_kg, current_weight_kg),
               status            = COALESCE(p_status,            status),
               latitude          = COALESCE(p_latitude,          latitude),
               longitude         = COALESCE(p_longitude,         longitude)
         WHERE id = p_id
        RETURNING * INTO v_warehouse;
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Warehouse name already exists' USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'Current weight exceeds max capacity (RN-03)'
                USING ERRCODE = 'SH422';
    END;

    IF v_warehouse.id IS NULL THEN
        RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_warehouse;
END $$;
