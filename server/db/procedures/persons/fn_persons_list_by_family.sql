-- List the persons that belong to a family, ordered deterministically (by
-- relationship then name). Returns SH404 if the family does not exist so the
-- API can surface the difference between "exists with no members" (the SP
-- prevents this state via sp_persons_delete) and "no such family".

CREATE OR REPLACE FUNCTION fn_persons_list_by_family(p_family_id INTEGER)
RETURNS SETOF persons
LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN QUERY
        SELECT *
          FROM persons
         WHERE family_id = p_family_id
         ORDER BY
            CASE relationship
                WHEN 'PADRE_MADRE' THEN 0
                WHEN 'ESPOSO_A'    THEN 1
                WHEN 'HIJO_A'      THEN 2
                WHEN 'HERMANO_A'   THEN 3
                ELSE 4
            END,
            name ASC,
            id ASC;
END $$;
