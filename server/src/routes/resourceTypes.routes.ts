import { Router } from 'express';
import * as controller from '../controllers/resourceTypes.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createResourceTypeRules,
  updateResourceTypeRules,
  idParamRule,
} from '../validators/resourceTypes.validator';

const router = Router();

router.use(authenticate);

// Read-only — any authenticated user
router.get('/', controller.list);
router.get('/:id', validate(idParamRule), controller.getById);

// Mutations — ADMIN or COORDINADOR_LOGISTICA (RF-12)
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createResourceTypeRules),
  controller.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateResourceTypeRules]),
  controller.update,
);

// Soft delete (deactivar) — mantiene referencias históricas válidas (HU-14 CA4).
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  controller.remove,
);

export default router;
