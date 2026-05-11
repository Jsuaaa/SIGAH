-- fn_relocations_find_by_id.sql
-- Obtiene un traslado por id, enriquecido con snapshot de familia y refugios.

CREATE OR REPLACE FUNCTION fn_relocations_find_by_id(p_id INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id',                     r.id,
        'family_id',              r.family_id,
        'origin_shelter_id',      r.origin_shelter_id,
        'destination_shelter_id', r.destination_shelter_id,
        'type',                   r.type,
        'relocation_date',        r.relocation_date,
        'reason',                 r.reason,
        'authorized_by',          r.authorized_by,
        'notes',                  r.notes,
        'created_at',             r.created_at,
        'updated_at',             r.updated_at,
        'family', jsonb_build_object(
            'id',              f.id,
            'family_code',     f.family_code,
            'head_document',   f.head_document,
            'num_members',     f.num_members,
            'status',          f.status,
            'zone_id',         f.zone_id
        ),
        'origin_shelter', CASE
            WHEN s_origin.id IS NULL THEN NULL
            ELSE jsonb_build_object(
                'id',               s_origin.id,
                'name',             s_origin.name,
                'address',          s_origin.address,
                'max_capacity',     s_origin.max_capacity,
                'current_occupancy',s_origin.current_occupancy
            )
        END,
        'destination_shelter', jsonb_build_object(
            'id',               s_dest.id,
            'name',             s_dest.name,
            'address',          s_dest.address,
            'max_capacity',     s_dest.max_capacity,
            'current_occupancy',s_dest.current_occupancy
        ),
        'authorized_by_user', jsonb_build_object(
            'id',   u.id,
            'name', u.name,
            'role', u.role
        )
    )
    INTO v_result
    FROM relocations r
    JOIN families f       ON f.id = r.family_id
    JOIN shelters s_dest  ON s_dest.id = r.destination_shelter_id
    JOIN users    u       ON u.id = r.authorized_by
    LEFT JOIN shelters s_origin ON s_origin.id = r.origin_shelter_id
    WHERE r.id = p_id;

    RETURN v_result;  -- NULL si no existe (el model lo maneja con SH404)
END;
$$;
