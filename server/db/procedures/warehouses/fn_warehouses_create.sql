-- Create a warehouse. Raises SH404 if the zone does not exist, SH409 on
-- duplicate name, SH422 when current_weight_kg > max_capacity_kg (RN-03).

CREATE OR REPLACE FUNCTION fn_warehouses_create(
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
        INSERT INTO warehouses (
            name, address, zone_id, max_capacity_kg, current_weight_kg,
            status, latitude, longitude
        )
        VALUES (
            p_name, p_address, p_zone_id, p_max_capacity_kg,
            COALESCE(p_current_weight_kg, 0),
            COALESCE(p_status, 'ACTIVE'),
            p_latitude, p_longitude
        )
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

    RETURN v_warehouse;
END $$;
