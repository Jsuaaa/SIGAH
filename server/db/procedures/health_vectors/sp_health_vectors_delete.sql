-- sp_health_vectors_delete
-- Elimina un vector de salud. Solo ADMIN puede invocar este SP (enforced at routes).
-- Raises SH404 si no existe.
--
-- audit:#47

CREATE OR REPLACE FUNCTION sp_health_vectors_delete(
    p_id      INTEGER,
    p_user_id INTEGER
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_before JSONB;
BEGIN
    SELECT to_jsonb(hv) INTO v_before FROM health_vectors hv WHERE id = p_id;

    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Health vector % not found', p_id USING ERRCODE = 'SH404';
    END IF;

    DELETE FROM health_vectors WHERE id = p_id;

    -- Auditoría: DELETE HealthVector (Issue #47)
    PERFORM sp_audit_insert(
        'DELETE',
        'health_vectors',
        'HealthVector',
        p_id,
        p_user_id,
        v_before,
        NULL,   -- after = NULL en DELETE
        NULL,   -- ip no disponible en firma actual
        NULL    -- user_agent no disponible en firma actual
    );
END $$;
