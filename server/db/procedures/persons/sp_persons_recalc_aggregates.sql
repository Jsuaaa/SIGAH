-- Recompute families.num_* counters from the persons rows belonging to that
-- family AND refresh the priority_score / priority_score_breakdown via
-- sp_priority_recalc (RN-08). Called by every persons mutation SP. Keeping
-- both updates in one place guarantees a consistent view of the family.
--
-- Aggregate rules:
--   num_members           = total persons.
--   num_children_under_5  = age < 5 (computed from birth_date).
--   num_adults_over_65    = age > 65.
--   num_pregnant          = special_conditions contains 'PREGNANT'.
--   num_disabled          = special_conditions contains 'DISABLED'.

CREATE OR REPLACE FUNCTION sp_persons_recalc_aggregates(p_family_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_members  INTEGER;
    v_children INTEGER;
    v_elders   INTEGER;
    v_pregnant INTEGER;
    v_disabled INTEGER;
BEGIN
    SELECT
        count(*),
        count(*) FILTER (
            WHERE date_part('year', age(birth_date)) < 5
        ),
        count(*) FILTER (
            WHERE date_part('year', age(birth_date)) > 65
        ),
        count(*) FILTER (WHERE 'PREGNANT' = ANY(special_conditions)),
        count(*) FILTER (WHERE 'DISABLED' = ANY(special_conditions))
      INTO v_members, v_children, v_elders, v_pregnant, v_disabled
      FROM persons
     WHERE family_id = p_family_id;

    UPDATE families
       SET num_members          = v_members,
           num_children_under_5 = v_children,
           num_adults_over_65   = v_elders,
           num_pregnant         = v_pregnant,
           num_disabled         = v_disabled
     WHERE id = p_family_id;

    -- RN-08: composition changed → refresh score + breakdown.
    PERFORM sp_priority_recalc(p_family_id);
END $$;
