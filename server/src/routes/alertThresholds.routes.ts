import { Router } from 'express';
import * as alertsController from '../controllers/alerts.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { setThresholdRules } from '../validators/alerts.validator';

const router = Router();

router.use(authenticate);

router.get('/', alertsController.listThresholds);

// Editable por ADMIN/COORDINADOR_LOGISTICA (HU-16 CA2).
router.put(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(setThresholdRules),
  alertsController.setThreshold,
);

export default router;
