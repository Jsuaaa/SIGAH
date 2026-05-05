-- Find a family by primary key. Returns the row or no rows.

CREATE OR REPLACE FUNCTION fn_families_find_by_id(p_id INTEGER)
RETURNS SETOF families
LANGUAGE sql STABLE AS $$
    SELECT * FROM families WHERE id = p_id LIMIT 1;
$$;
