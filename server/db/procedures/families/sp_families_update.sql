-- Partial update of a family. NULL inputs are ignored.
--
-- Aggregate counts (num_members, num_children_under_5, …) are NOT updated
-- here: issue #14 wires them to person mutations via sp_persons_upsert_and_recalc.
-- Allow direct edits only for fields that don't affect the priority score.
--
-- Raises:
--   SH404 if the family, target zone or target shelter does not exist.
--   SH422 if the resulting aggregates violate the CHECK constraint.

CREATE OR REPLACE FUNCTION sp_families_update(
    p_id                INTEGER,
    p_head_document     TEXT,
    p_zone_id           INTEGER,
    p_shelter_id        INTEGER,
    p_status            family_status,
    p_latitude          DOUBLE PRECISION,
    p_longitude         DOUBLE PRECISION,
    p_reference_address TEXT
)
RETURNS families
LANGUAGE plpgsql AS $$
DECLARE
    v_family   families;
    v_old_zone INTEGER;
BEGIN
    SELECT zone_id INTO v_old_zone FROM families WHERE id = p_id;
    -- (no SH404 here — the UPDATE below handles missing rows)

    BEGIN
        UPDATE families
           SET head_document     = COALESCE(p_head_document,     head_document),
               zone_id           = COALESCE(p_zone_id,           zone_id),
               shelter_id        = COALESCE(p_shelter_id,        shelter_id),
               status            = COALESCE(p_status,            status),
               latitude          = COALESCE(p_latitude,          latitude),
               longitude         = COALESCE(p_longitude,         longitude),
               reference_address = COALESCE(p_reference_address, reference_address)
         WHERE id = p_id
        RETURNING * INTO v_family;
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE EXCEPTION 'Referenced zone or shelter not found' USING ERRCODE = 'SH404';
        WHEN check_violation THEN
            RAISE EXCEPTION 'Invalid family aggregate counts' USING ERRCODE = 'SH422';
    END;

    IF v_family.id IS NULL THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    -- A zone change shifts zone_risk_factor → recalc the priority score
    -- (RN-08). Other field changes (status, address, …) don't touch the
    -- formula inputs, so we skip the recalc to avoid a wasted query.
    IF v_family.zone_id IS DISTINCT FROM v_old_zone THEN
        PERFORM sp_priority_recalc(p_id);
        SELECT * INTO v_family FROM families WHERE id = p_id;
    END IF;

    RETURN v_family;
END $$;
