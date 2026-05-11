-- List configured alert thresholds, joined with resource_types so the API can
-- render category and unit information without a second query.
--
-- Filter:
--   p_category : optional resource_category. NULL → all.

CREATE OR REPLACE FUNCTION fn_alert_thresholds_list(p_category resource_category)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'id',               t.id,
        'resource_type_id', t.resource_type_id,
        'min_quantity',     t.min_quantity,
        'updated_by',       t.updated_by,
        'updated_at',       t.updated_at,
        'resource', jsonb_build_object(
            'id',              r.id,
            'name',            r.name,
            'category',        r.category,
            'unit_of_measure', r.unit_of_measure,
            'unit_weight_kg',  r.unit_weight_kg,
            'is_active',       r.is_active
        )
    ) AS data
      FROM alert_thresholds t
      JOIN resource_types r ON r.id = t.resource_type_id
     WHERE (p_category IS NULL OR r.category = p_category)
     ORDER BY r.category ASC, r.name ASC;
$$;
