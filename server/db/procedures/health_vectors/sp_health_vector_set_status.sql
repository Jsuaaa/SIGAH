-- sp_health_vector_set_status
-- Actualiza el estado de un vector de salud y registra actions_taken.
--
-- Reglas de transición (HU-25 CA3):
--   ACTIVO      → EN_ATENCION (OK)
--   ACTIVO      → RESUELTO    (OK)
--   EN_ATENCION → RESUELTO    (OK)
--   EN_ATENCION → ACTIVO      (OK)  -- regresión permitida
--   RESUELTO    → ACTIVO      (SH422)  -- no se permite reabrir
--   RESUELTO    → EN_ATENCION (SH422)  -- no se permite reabrir
--
-- Si el nuevo status es RESUELTO se registra resolved_at = now().
-- Si pasa de RESUELTO a otro (bloqueado) se lanza SH422.
--
-- audit:#47

CREATE OR REPLACE FUNCTION sp_health_vector_set_status(
    p_id           INTEGER,
    p_new_status   health_vector_status,
    p_actions_taken TEXT,
    p_user_id      INTEGER,
    p_ip           INET,
    p_user_agent   TEXT
)
RETURNS health_vectors
LANGUAGE plpgsql AS $$
DECLARE
    v_current_status health_vector_status;
    v_before         JSONB;
    v_row            health_vectors;
BEGIN
    SELECT status, to_jsonb(hv)
      INTO v_current_status, v_before
      FROM health_vectors hv
     WHERE id = p_id;

    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Health vector % not found', p_id USING ERRCODE = 'SH404';
    END IF;

    -- Validate transition: desde RESUELTO no puede volver a ACTIVO o EN_ATENCION
    IF v_current_status = 'RESUELTO' AND p_new_status <> 'RESUELTO' THEN
        RAISE EXCEPTION
            'Cannot transition health vector from RESUELTO to % (HU-25 CA3)',
            p_new_status
            USING ERRCODE = 'SH422';
    END IF;

    UPDATE health_vectors
       SET status        = p_new_status,
           actions_taken = COALESCE(NULLIF(p_actions_taken, ''), actions_taken),
           resolved_at   = CASE
                               WHEN p_new_status = 'RESUELTO' THEN now()
                               ELSE resolved_at
                           END
     WHERE id = p_id
    RETURNING * INTO v_row;

    -- Auditoría: SET_STATUS HealthVector (Issue #47)
    PERFORM sp_audit_insert(
        'SET_STATUS',
        'health_vectors',
        'HealthVector',
        v_row.id,
        p_user_id,
        v_before,
        to_jsonb(v_row),
        p_ip,
        p_user_agent
    );

    RETURN v_row;
END $$;
