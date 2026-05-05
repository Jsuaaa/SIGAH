-- Create a resource_type. Raises SH409 on duplicate (name, category) (HU-14
-- CA2). The pair is unique because the same name can mean different things
-- across categories (e.g. "Botiquín" as MEDICATION vs HYGIENE kit).

CREATE OR REPLACE FUNCTION fn_resource_types_create(
    p_name            TEXT,
    p_category        resource_category,
    p_unit_of_measure TEXT,
    p_unit_weight_kg  DOUBLE PRECISION
)
RETURNS resource_types
LANGUAGE plpgsql AS $$
DECLARE
    v_row resource_types;
BEGIN
    BEGIN
        INSERT INTO resource_types (name, category, unit_of_measure, unit_weight_kg)
        VALUES (p_name, p_category, p_unit_of_measure, p_unit_weight_kg)
        RETURNING * INTO v_row;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Resource type already exists for this category'
                USING ERRCODE = 'SH409';
        WHEN check_violation THEN
            RAISE EXCEPTION 'unit_weight_kg must be >= 0' USING ERRCODE = 'SH422';
    END;

    RETURN v_row;
END $$;
