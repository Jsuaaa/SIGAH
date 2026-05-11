-- sp_relocation_apply.sql
-- Aplica un traslado de familia entre refugios de forma atómica (HU-24, RF-15).
-- Parámetros:
--   p_request     JSONB  {family_id, destination_shelter_id, type, reason, notes?}
--   p_user_id     INT    usuario autenticado que autoriza el traslado
--   p_ip          INET   IP del cliente (para auditoría futura)
--   p_user_agent  TEXT   user-agent del cliente (para auditoría futura)
--
-- Errores:
--   SH404 — familia o refugio destino no existen
--   SH422 — la familia ya está en el refugio destino
--   SH409 — el refugio destino no tiene capacidad suficiente (HU-24 CA3)
--
-- Retorna la fila creada en relocations.

CREATE OR REPLACE FUNCTION sp_relocation_apply(
    p_request    JSONB,
    p_user_id    INT,
    p_ip         INET,
    p_user_agent TEXT
)
RETURNS relocations
LANGUAGE plpgsql
AS $$
DECLARE
    v_family_id             INT;
    v_destination_id        INT;
    v_type                  relocation_type;
    v_reason                TEXT;
    v_notes                 TEXT;

    v_family                families%ROWTYPE;
    v_destination           shelters%ROWTYPE;
    v_relocation            relocations%ROWTYPE;
BEGIN
    -- Extraer campos del JSON de entrada
    v_family_id      := (p_request->>'family_id')::INT;
    v_destination_id := (p_request->>'destination_shelter_id')::INT;
    v_type           := (p_request->>'type')::relocation_type;
    v_reason         := trim(p_request->>'reason');
    v_notes          := p_request->>'notes';

    -- Validar que la familia existe
    SELECT * INTO v_family
    FROM families
    WHERE id = v_family_id
    FOR UPDATE;  -- bloqueo para actualización posterior

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found'
            USING ERRCODE = 'SH404';
    END IF;

    -- Validar que el refugio destino existe
    SELECT * INTO v_destination
    FROM shelters
    WHERE id = v_destination_id
    FOR UPDATE;  -- bloqueo para actualización de ocupación

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination shelter not found'
            USING ERRCODE = 'SH404';
    END IF;

    -- Validar que la familia no ya está en el destino
    IF v_family.shelter_id IS NOT NULL AND v_family.shelter_id = v_destination_id THEN
        RAISE EXCEPTION 'Family is already at this shelter'
            USING ERRCODE = 'SH422';
    END IF;

    -- Verificar capacidad del destino (HU-24 CA3 / RN derivada)
    IF (v_destination.current_occupancy + v_family.num_members) > v_destination.max_capacity THEN
        RAISE EXCEPTION 'Destination shelter at capacity (occupancy=%, members=%, max=%)',
            v_destination.current_occupancy, v_family.num_members, v_destination.max_capacity
            USING ERRCODE = 'SH409';
    END IF;

    -- Decrementar ocupación del refugio origen (si la familia venía de uno)
    IF v_family.shelter_id IS NOT NULL THEN
        UPDATE shelters
        SET current_occupancy = current_occupancy - v_family.num_members,
            updated_at = now()
        WHERE id = v_family.shelter_id;
    END IF;

    -- Incrementar ocupación del refugio destino
    UPDATE shelters
    SET current_occupancy = current_occupancy + v_family.num_members,
        updated_at = now()
    WHERE id = v_destination_id;

    -- Actualizar familia: nuevo refugio + estado EN_REFUGIO
    UPDATE families
    SET shelter_id = v_destination_id,
        status     = 'EN_REFUGIO',
        updated_at = now()
    WHERE id = v_family_id;

    -- Insertar registro de traslado
    INSERT INTO relocations (
        family_id,
        origin_shelter_id,
        destination_shelter_id,
        type,
        reason,
        authorized_by,
        notes,
        relocation_date,
        created_at,
        updated_at
    ) VALUES (
        v_family_id,
        v_family.shelter_id,   -- puede ser NULL (familia sin refugio previo)
        v_destination_id,
        v_type,
        v_reason,
        p_user_id,
        v_notes,
        now(),
        now(),
        now()
    )
    RETURNING * INTO v_relocation;

    -- Auditoría: CREATE Relocation (Issue #47)
    PERFORM sp_audit_insert(
        'CREATE',
        'relocations',
        'Relocation',
        v_relocation.id,
        p_user_id,
        NULL,
        to_jsonb(v_relocation),
        p_ip,
        p_user_agent
    );

    RETURN v_relocation;
END;
$$;
