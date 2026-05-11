-- Migration 020: sync_log table for offline PWA idempotency (#32 / GH #48)
-- Stores each processed offline op so retries return cached results without
-- duplicating data. Also used by POST /sync batch endpoint.

CREATE TABLE IF NOT EXISTS sync_log (
  id           BIGSERIAL    PRIMARY KEY,
  client_op_id TEXT         NOT NULL UNIQUE,
  method       TEXT         NOT NULL,
  url          TEXT         NOT NULL,
  payload      JSONB,
  response     JSONB,
  status_code  INT          NOT NULL,
  processed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  user_id      INT          REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sync_log_user_id_idx       ON sync_log (user_id);
CREATE INDEX IF NOT EXISTS sync_log_processed_at_idx  ON sync_log (processed_at DESC);

COMMENT ON TABLE sync_log IS
  'Central idempotency log for offline sync. One row per client_op_id; duplicate ops return the cached response.';
