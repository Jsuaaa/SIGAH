-- Top-N eligible families ordered by priority_score DESC (HU-21, HU-22).
--
-- Eligibility delegates to fn_families_get_eligibility, which now reads
-- deliveries (#22) and excludes families whose previous coverage window is
-- still open (RN-02).
--
-- Returns the same shape as fn_prioritization_ranking but as one row per
-- family (no aggregation, no total count) so the API can stream it.

CREATE OR REPLACE FUNCTION fn_prioritization_next_batch(p_count INTEGER)
RETURNS TABLE (data JSONB)
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'id',                       f.id,
        'family_code',              f.family_code,
        'head_document',            f.head_document,
        'zone_id',                  f.zone_id,
        'zone_name',                z.name,
        'shelter_id',               f.shelter_id,
        'num_members',              f.num_members,
        'priority_score',           f.priority_score,
        'priority_score_breakdown', f.priority_score_breakdown,
        'status',                   f.status,
        'last_delivery_date',       (SELECT MAX(d.delivery_date)
                                       FROM deliveries d
                                      WHERE d.family_id = f.id
                                        AND d.status    = 'ENTREGADA'),
        'eligibility',              jsonb_build_object(
            'is_eligible',      e.is_eligible,
            'reason',           e.reason,
            'next_eligible_at', e.next_eligible_at
        )
    ) AS data
      FROM families f
      JOIN zones z ON z.id = f.zone_id
      JOIN LATERAL fn_families_get_eligibility(f.id) e ON TRUE
     WHERE e.is_eligible = TRUE
     ORDER BY f.priority_score DESC, f.id ASC
     LIMIT GREATEST(COALESCE(p_count, 10), 1);
$$;
