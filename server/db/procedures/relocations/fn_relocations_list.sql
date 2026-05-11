-- fn_relocations_list.sql
-- Lista traslados con filtros opcionales y paginación (HU-24, Issue #27).
--
-- Filtros:
--   p_family_id  — por familia específica
--   p_shelter_id — por origen O destino (cualquiera)
--   p_type       — TEMPORARY | PERMANENT
--   p_date_from  — fecha inicio (relocation_date >=)
--   p_date_to    — fecha fin (relocation_date <=)
--   p_limit      — máximo de filas (paginación)
--   p_offset     — desplazamiento (paginación)
--
-- Retorna TABLE(data JSONB, total BIGINT) — una única fila con el array
-- y el conteo total, compatible con el patrón del proyecto.

CREATE OR REPLACE FUNCTION fn_relocations_list(
    p_family_id  INT      DEFAULT NULL,
    p_shelter_id INT      DEFAULT NULL,
    p_type       relocation_type DEFAULT NULL,
    p_date_from  TIMESTAMPTZ DEFAULT NULL,
    p_date_to    TIMESTAMPTZ DEFAULT NULL,
    p_limit      INT      DEFAULT 20,
    p_offset     INT      DEFAULT 0
)
RETURNS TABLE(data JSONB, total BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rows  JSONB;
    v_total BIGINT;
BEGIN
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
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
                        'id',          f.id,
                        'family_code', f.family_code,
                        'num_members', f.num_members,
                        'status',      f.status
                    ),
                    'origin_shelter', CASE
                        WHEN s_origin.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id',   s_origin.id,
                            'name', s_origin.name
                        )
                    END,
                    'destination_shelter', jsonb_build_object(
                        'id',   s_dest.id,
                        'name', s_dest.name
                    )
                )
                ORDER BY r.relocation_date DESC
            ),
            '[]'::jsonb
        ),
        COUNT(*) OVER ()
    INTO v_rows, v_total
    FROM relocations r
    JOIN families f       ON f.id = r.family_id
    JOIN shelters s_dest  ON s_dest.id = r.destination_shelter_id
    LEFT JOIN shelters s_origin ON s_origin.id = r.origin_shelter_id
    WHERE
        (p_family_id  IS NULL OR r.family_id = p_family_id)
        AND (p_shelter_id IS NULL
             OR r.origin_shelter_id = p_shelter_id
             OR r.destination_shelter_id = p_shelter_id)
        AND (p_type      IS NULL OR r.type = p_type)
        AND (p_date_from IS NULL OR r.relocation_date >= p_date_from)
        AND (p_date_to   IS NULL OR r.relocation_date <= p_date_to)
    LIMIT  p_limit
    OFFSET p_offset;

    -- Cuando no hay filas, v_total es NULL; normalizar a 0
    v_total := COALESCE(v_total, 0);
    v_rows  := COALESCE(v_rows, '[]'::jsonb);

    RETURN QUERY SELECT v_rows, v_total;
END;
$$;
