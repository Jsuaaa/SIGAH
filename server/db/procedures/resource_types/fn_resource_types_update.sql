-- Partial update for resource_types (NULL inputs are ignored). Raises:
--   SH404 when the row does not exist.
--   SH409 on duplicate (name, category).
--   SH422 when unit_weight_kg < 0.

CREATE OR REPLACE FUNCTION fn_resource_types_update(
    p_id              INTEGER,
    p_name            TEXT,
    p_category        resource_category,
    p_unit_of_measure TEXT,
    p_unit_weight_kg  DOUBLE PRECISION,
    p_is_active       BOOLEAN
)
RETURNS resource_types
LANGUAGE plpgsql AS $$
DECLARE
    v_row resource_types;
BEGIN
    BEGIN
        UPDATE resource_types
           SET name            = COALESCE(p_name,            name),
               category        = COALESCE(p_category,        category),
               unit_of_measure = COALESCE(p_unit_of_measure, unit_of_measure),
               unit_weight_kg  = COALESCE(p_unit_weight_kg,  unit_weight_kg),
               is_active       = COALESCE(p_is_active,       is_active)
         WHERE id = p_id
        RETURNING * INTO v_row;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Resource type already exists for this category'
                USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'unit_weight_kg must be >= 0' USING ERRCODE = 'SH422';
    END;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
    END IF;

    RETURN v_row;
END $$;
