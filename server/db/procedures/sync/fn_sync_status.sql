-- fn_sync_status: summary stats for GET /sync/status.
-- Returns last_processed_at, total_ops and ops_today for a given user.
-- If p_user_id IS NULL, aggregates across all users (admin view).

CREATE OR REPLACE FUNCTION fn_sync_status(p_user_id INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'last_processed_at', MAX(processed_at),
    'total_ops',         COUNT(*),
    'ops_today',         COUNT(*) FILTER (
                           WHERE processed_at >= CURRENT_DATE::TIMESTAMPTZ
                             AND processed_at  < (CURRENT_DATE + 1)::TIMESTAMPTZ
                         )
  )
  FROM sync_log
  WHERE (p_user_id IS NULL OR user_id = p_user_id);
$$;
