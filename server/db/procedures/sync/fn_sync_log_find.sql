-- fn_sync_log_find: lookup a sync_log entry by client_op_id.
-- Returns NULL when not found (SETOF returns 0 rows).
-- Used by idempotency middleware BEFORE executing any mutation.

CREATE OR REPLACE FUNCTION fn_sync_log_find(p_client_op_id TEXT)
RETURNS SETOF sync_log
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM sync_log
  WHERE client_op_id = p_client_op_id
  LIMIT 1;
$$;
