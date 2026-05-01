-- Families that belong to a zone. Stub until #12 lands the families table.
-- The signature is final; the body will be replaced when the FK exists.

CREATE OR REPLACE FUNCTION fn_zones_families(p_zone_id INTEGER)
RETURNS TABLE (id INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT NULL::INTEGER WHERE FALSE;  -- empty result set, matches the route's [] contract
$$;
