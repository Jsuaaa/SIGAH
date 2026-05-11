-- Advance a delivery through its status lifecycle (#24 CA6).
--
-- Allowed transitions:
--   PROGRAMADA  → EN_CURSO
--   EN_CURSO    → ENTREGADA   (sets delivery_date = now())
--
-- Any other transition (including reversals) raises SH422.
--
-- Inputs:
--   p_delivery_id : PK of the delivery row.
--   p_new_status  : target delivery_status enum value.
--   p_user_id     : user performing the action (reserved for audit #47).
--
-- Returns the updated deliveries row.

CREATE OR REPLACE FUNCTION sp_delivery_update_status(
    p_delivery_id INTEGER,
    p_new_status  delivery_status,
    p_user_id     INTEGER
)
RETURNS deliveries
LANGUAGE plpgsql AS $$
DECLARE
    v_current    deliveries;
    v_updated    deliveries;
    v_new_date   TIMESTAMPTZ;
BEGIN
    -- p_user_id usado en auditoría al final del SP (Issue #47).

    -- 1. Load the current row.
    SELECT * INTO v_current FROM deliveries WHERE id = p_delivery_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'SH404';
    END IF;

    -- 2. Validate transition.
    IF NOT (
        (v_current.status = 'PROGRAMADA' AND p_new_status = 'EN_CURSO')
        OR
        (v_current.status = 'EN_CURSO'   AND p_new_status = 'ENTREGADA')
    ) THEN
        RAISE EXCEPTION 'Invalid status transition: % → %',
            v_current.status, p_new_status
            USING ERRCODE = 'SH422';
    END IF;

    -- 3. Set delivery_date when the delivery is confirmed as delivered.
    v_new_date := CASE
        WHEN p_new_status = 'ENTREGADA' THEN now()
        ELSE v_current.delivery_date
    END;

    -- 4. Apply the update.
    UPDATE deliveries
       SET status       = p_new_status,
           delivery_date = v_new_date,
           updated_at   = now()
     WHERE id = p_delivery_id
    RETURNING * INTO v_updated;

    -- Auditoría: UPDATE_STATUS Delivery (Issue #47)
    PERFORM sp_audit_insert(
        'UPDATE_STATUS',
        'deliveries',
        'Delivery',
        v_updated.id,
        p_user_id,
        to_jsonb(v_current),
        to_jsonb(v_updated),
        NULL,   -- ip no disponible en firma actual
        NULL    -- user_agent no disponible en firma actual
    );

    -- 5. RN-08: refresh priority score when delivery is confirmed ENTREGADA.
    IF p_new_status = 'ENTREGADA' THEN
        PERFORM sp_priority_recalc(v_updated.family_id);
    END IF;

    RETURN v_updated;
END $$;
