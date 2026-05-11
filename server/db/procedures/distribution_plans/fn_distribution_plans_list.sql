-- fn_distribution_plans_list (Issue #46)
--
-- Lista planes de distribución con paginación y filtros opcionales.
-- Devuelve (data JSONB[], total BIGINT) en una sola fila.
--
-- Inputs:
--   p_status     : filtro por status (NULL = todos).
--   p_scope      : filtro por scope  (NULL = todos).
--   p_created_by : filtro por usuario creador (NULL = todos).
--   p_limit      : cantidad máxima de filas.
--   p_offset     : desplazamiento para paginación.

CREATE OR REPLACE FUNCTION fn_distribution_plans_list(
    p_status     distribution_plan_status,
    p_scope      distribution_plan_scope,
    p_created_by INTEGER,
    p_limit      INTEGER,
    p_offset     INTEGER
)
RETURNS TABLE (data JSONB[], total BIGINT)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_total BIGINT;
    v_rows  JSONB[];
BEGIN
    SELECT COUNT(*)::BIGINT
      INTO v_total
      FROM distribution_plans dp
     WHERE (p_status     IS NULL OR dp.status     = p_status)
       AND (p_scope      IS NULL OR dp.scope      = p_scope)
       AND (p_created_by IS NULL OR dp.created_by = p_created_by);

    SELECT ARRAY(
        SELECT to_jsonb(dp) || jsonb_build_object(
            'items_total',      (SELECT COUNT(*) FROM distribution_plan_items WHERE plan_id = dp.id),
            'items_pendientes', (SELECT COUNT(*) FROM distribution_plan_items WHERE plan_id = dp.id AND status = 'PENDIENTE'),
            'items_entregados', (SELECT COUNT(*) FROM distribution_plan_items WHERE plan_id = dp.id AND status = 'ENTREGADO'),
            'items_sin_atender',(SELECT COUNT(*) FROM distribution_plan_items WHERE plan_id = dp.id AND status = 'SIN_ATENDER')
        )
          FROM distribution_plans dp
         WHERE (p_status     IS NULL OR dp.status     = p_status)
           AND (p_scope      IS NULL OR dp.scope      = p_scope)
           AND (p_created_by IS NULL OR dp.created_by = p_created_by)
         ORDER BY dp.created_at DESC
         LIMIT  p_limit
         OFFSET p_offset
    ) INTO v_rows;

    RETURN QUERY SELECT COALESCE(v_rows, ARRAY[]::JSONB[]), v_total;
END $$;
