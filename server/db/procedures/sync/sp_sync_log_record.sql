-- sp_sync_log_record: insert a new sync_log entry.
-- ON CONFLICT DO NOTHING makes it safe to call even when the idempotency key
-- was already recorded (race condition between middleware and batch endpoint).

CREATE OR REPLACE PROCEDURE sp_sync_log_record(
  p_client_op_id TEXT,
  p_method       TEXT,
  p_url          TEXT,
  p_payload      JSONB,
  p_response     JSONB,
  p_status_code  INT,
  p_user_id      INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO sync_log
    (client_op_id, method, url, payload, response, status_code, processed_at, user_id)
  VALUES
    (p_client_op_id, p_method, p_url, p_payload, p_response, p_status_code, now(), p_user_id)
  ON CONFLICT (client_op_id) DO NOTHING;
END;
$$;
