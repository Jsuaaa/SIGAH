import { Router } from 'express';
import * as controller from '../controllers/distributionPlans.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPlanRules,
  idParamRule,
  listPlanRules,
} from '../validators/distributionPlans.validator';

const router = Router();

// Todas las rutas requieren autenticación.
router.use(authenticate);

// POST /distribution-plans — solo ADMIN y COORDINADOR_LOGISTICA (HU-21 CA6).
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createPlanRules),
  controller.create,
);

// GET /distribution-plans — cualquier usuario autenticado puede listar.
router.get('/', validate(listPlanRules), controller.list);

// GET /distribution-plans/:id — detalle con items embebidos.
router.get('/:id', validate(idParamRule), controller.getById);

// PUT /distribution-plans/:id/cancel — solo ADMIN y COORDINADOR_LOGISTICA.
router.put(
  '/:id/cancel',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  controller.cancel,
);

// POST /distribution-plans/:id/execute — solo ADMIN y COORDINADOR_LOGISTICA.
router.post(
  '/:id/execute',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  controller.execute,
);

export default router;
