-- Shelters that belong to a zone. Stub until #11 lands the shelters table.

CREATE OR REPLACE FUNCTION fn_zones_shelters(p_zone_id INTEGER)
RETURNS TABLE (id INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT NULL::INTEGER WHERE FALSE;
$$;
