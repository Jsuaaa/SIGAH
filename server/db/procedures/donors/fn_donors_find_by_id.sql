CREATE OR REPLACE FUNCTION fn_donors_find_by_id(p_id INTEGER)
RETURNS SETOF donors
LANGUAGE sql STABLE AS $$
    SELECT * FROM donors WHERE id = p_id LIMIT 1;
$$;
