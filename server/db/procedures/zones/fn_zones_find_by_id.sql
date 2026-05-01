-- Find a zone by primary key. Returns the row or no rows.

CREATE OR REPLACE FUNCTION fn_zones_find_by_id(p_id INTEGER)
RETURNS SETOF zones
LANGUAGE sql STABLE AS $$
    SELECT * FROM zones WHERE id = p_id LIMIT 1;
$$;
