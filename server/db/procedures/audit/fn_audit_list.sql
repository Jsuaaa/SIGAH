-- fn_audit_list.sql
-- Lista entradas del log de auditoría con filtros opcionales y paginación.
-- Solo expuesta a FUNCIONARIO_CONTROL y ADMIN (HU-31 CA3, Issue #47).
--
-- Parámetros:
--   p_filters JSONB — objeto con filtros opcionales:
--     { user_id, module, action, entity, entity_id, date_from, date_to }
--   p_limit   INT   — filas por página (máx 200)
--   p_offset  INT   — desplazamiento

CREATE OR REPLACE FUNCTION fn_audit_list(
  p_filters JSONB,
  p_limit   INT,
  p_offset  INT
)
RETURNS TABLE(data JSONB, total BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id   INTEGER      := NULLIF(p_filters ->> 'user_id',   '')::INTEGER;
  v_module    TEXT         := NULLIF(p_filters ->> 'module',    '');
  v_action    TEXT         := NULLIF(p_filters ->> 'action',    '');
  v_entity    TEXT         := NULLIF(p_filters ->> 'entity',    '');
  v_entity_id INTEGER      := NULLIF(p_filters ->> 'entity_id', '')::INTEGER;
  v_date_from TIMESTAMPTZ  := NULLIF(p_filters ->> 'date_from', '')::TIMESTAMPTZ;
  v_date_to   TIMESTAMPTZ  := NULLIF(p_filters ->> 'date_to',   '')::TIMESTAMPTZ;
  v_limit     INT          := LEAST(COALESCE(p_limit,  50), 200);
  v_offset    INT          := COALESCE(p_offset, 0);
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT al.*
      FROM audit_logs al
     WHERE (v_user_id   IS NULL OR al.user_id   = v_user_id)
       AND (v_module    IS NULL OR al.module     = v_module)
       AND (v_action    IS NULL OR al.action     = v_action)
       AND (v_entity    IS NULL OR al.entity     = v_entity)
       AND (v_entity_id IS NULL OR al.entity_id  = v_entity_id)
       AND (v_date_from IS NULL OR al.created_at >= v_date_from)
       AND (v_date_to   IS NULL OR al.created_at <= v_date_to)
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  ),
  paginated AS (
    SELECT al.*
      FROM filtered al
     ORDER BY al.created_at DESC
     LIMIT  v_limit
     OFFSET v_offset
  )
  SELECT
    jsonb_build_object(
      'id',         p.id,
      'action',     p.action,
      'module',     p.module,
      'entity',     p.entity,
      'entity_id',  p.entity_id,
      'user_id',    p.user_id,
      'before',     p.before,
      'after',      p.after,
      'ip_address', p.ip_address::TEXT,
      'user_agent', p.user_agent,
      'created_at', p.created_at
    ) AS data,
    c.cnt AS total
  FROM paginated p
  CROSS JOIN counted c;
END $$;
