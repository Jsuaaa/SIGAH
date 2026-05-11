-- sp_audit_insert.sql
-- Función de auditoría compartida invocada desde todos los SPs de mutación.
-- Implementada como FUNCTION RETURNS VOID para poder usarla con PERFORM
-- tanto dentro de FUNCTIONs como de PROCEDUREs.
--
-- El bloque EXCEPTION garantiza que un fallo de auditoría NUNCA aborte
-- la transacción de negocio: se emite un WARNING y la mutación se completa.
--
-- Issue #47 (GH #28).

CREATE OR REPLACE FUNCTION sp_audit_insert(
  p_action     TEXT,
  p_module     TEXT,
  p_entity     TEXT,
  p_entity_id  INTEGER,
  p_user_id    INTEGER,
  p_before     JSONB,
  p_after      JSONB,
  p_ip         INET,
  p_user_agent TEXT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_logs (
    action, module, entity, entity_id,
    user_id, before, after,
    ip_address, user_agent
  )
  VALUES (
    p_action, p_module, p_entity, p_entity_id,
    p_user_id, p_before, p_after,
    p_ip, p_user_agent
  );
EXCEPTION WHEN OTHERS THEN
  -- Auditoría no debe interrumpir la transacción de negocio (RNF-09).
  RAISE WARNING 'sp_audit_insert failed (action=%, module=%, entity_id=%): %',
    p_action, p_module, p_entity_id, SQLERRM;
END $$;
