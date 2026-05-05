import { Router } from 'express';
import * as controller from '../controllers/inventory.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  upsertInventoryRules,
  adjustInventoryRules,
  idParamRule,
} from '../validators/inventory.validator';

const router = Router();

router.use(authenticate);

router.get('/summary', controller.summary);
router.get('/', controller.list);

// POST upsert — used by donation reception (#19) and admin tooling. Limited
// to ADMIN/COORDINATOR; donation flow itself reaches sp_donations_create.
router.post(
  '/',
  authorize('ADMIN', 'COORDINATOR'),
  validate(upsertInventoryRules),
  controller.upsert,
);

// HU-17 CA5: only ADMIN/COORDINADOR_LOGISTICA can perform manual adjustments.
router.put(
  '/:id/adjustment',
  authorize('ADMIN', 'COORDINATOR'),
  validate([...idParamRule, ...adjustInventoryRules]),
  controller.adjust,
);

export default router;
