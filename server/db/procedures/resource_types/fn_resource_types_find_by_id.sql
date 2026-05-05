CREATE OR REPLACE FUNCTION fn_resource_types_find_by_id(p_id INTEGER)
RETURNS SETOF resource_types
LANGUAGE sql STABLE AS $$
    SELECT * FROM resource_types WHERE id = p_id LIMIT 1;
$$;
