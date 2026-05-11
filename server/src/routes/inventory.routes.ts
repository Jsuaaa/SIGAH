import { Router } from 'express';
import * as controller from '../controllers/inventory.controller';
import * as alertsController from '../controllers/alerts.controller';
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
router.get('/alerts', alertsController.inventoryAlerts);
router.get('/', controller.list);

// POST upsert — usado por recepción de donaciones (#19) y tooling admin.
// Limitado a ADMIN/COORDINADOR_LOGISTICA.
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(upsertInventoryRules),
  controller.upsert,
);

// HU-17 CA5: solo ADMIN/COORDINADOR_LOGISTICA pueden hacer ajustes manuales.
router.put(
  '/:id/adjustment',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...adjustInventoryRules]),
  controller.adjust,
);

export default router;
