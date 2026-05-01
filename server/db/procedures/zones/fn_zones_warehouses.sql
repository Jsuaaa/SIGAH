-- Warehouses that belong to a zone. Stub until #15 lands the warehouses table.

CREATE OR REPLACE FUNCTION fn_zones_warehouses(p_zone_id INTEGER)
RETURNS TABLE (id INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT NULL::INTEGER WHERE FALSE;
$$;
