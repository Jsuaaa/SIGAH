/**
 * sync.routes.ts
 *
 * Routes:
 *   POST /api/v1/sync        — batch offline ops (all authenticated roles)
 *   GET  /api/v1/sync/status — sync statistics for the requesting user
 *
 * References: Issue #32 / GH #48.
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { processBatchRules } from '../validators/sync.validator';
import * as syncController from '../controllers/sync.controller';

const router = Router();

// All sync endpoints require authentication.
router.use(authenticate);

// GET /status must be before POST / to avoid param collision (though here they differ).
router.get('/status', syncController.status);

// POST / — process a batch of pending offline ops.
router.post('/', validate(processBatchRules), syncController.processBatch);

export default router;
