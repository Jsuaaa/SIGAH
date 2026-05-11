/**
 * sync.controller.ts
 *
 * Handlers for:
 *   POST /api/v1/sync       — process a batch of offline ops
 *   GET  /api/v1/sync/status — return sync statistics for the current user
 *
 * References: Issue #32 / GH #48.
 */

import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as syncService from '../services/sync.service';

/**
 * POST /api/v1/sync
 * Body: { ops: SyncOp[] }
 * Returns: { success: true, data: SyncOpResult[] }
 */
export const processBatch = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const { ops } = req.body as { ops: syncService.SyncOp[] };
  const results = await syncService.processBatch(ops, user.id);

  res.json({ success: true, data: results });
});

/**
 * GET /api/v1/sync/status
 * Returns: { success: true, data: { last_processed_at, total_ops, ops_today } }
 */
export const status = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const data = await syncService.getStatus(user.id);
  res.json({ success: true, data });
});
