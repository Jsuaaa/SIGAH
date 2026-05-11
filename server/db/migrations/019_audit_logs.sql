-- 019_audit_logs.sql
-- Tabla inmutable de auditoría (RNF-09, CV-11, HU-31).
-- Issue #47 (GH #28). Depende de: 003_users.sql.

CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  action       TEXT         NOT NULL,  -- CREATE, UPDATE, DELETE, SET_STATUS, LOGIN_SUCCESS, LOGIN_FAILED, LOGIN_LOCKED, etc.
  module       TEXT         NOT NULL,  -- users, donations, deliveries, relocations, etc.
  entity       TEXT         NOT NULL,  -- User, Donation, Delivery, Relocation, etc.
  entity_id    INTEGER,                -- NULL para acciones globales (ej. login fallido sin usuario)
  user_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  before       JSONB,                  -- snapshot anterior (NULL en CREATE)
  after        JSONB,                  -- snapshot nuevo (NULL en DELETE)
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índices de consulta frecuente (HU-31 CA3)
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_module_action_idx ON audit_logs (module, action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx     ON audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Trigger de inmutabilidad: prohíbe UPDATE y DELETE (RNF-09, CV-11).
-- El REVOKE adicional bloquea accesos directos SQL si el proyecto define un
-- rol de aplicación. Los triggers cubren también la sesión superuser.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_logs_prevent_modification()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only — % not allowed', TG_OP
    USING ERRCODE = 'SH403';
END $$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_modification();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs
;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_modification();
