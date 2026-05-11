import { Router } from 'express';
import * as healthVectorsController from '../controllers/healthVectors.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createRules,
  updateRules,
  setStatusRules,
  listRules,
  idParamRule,
} from '../validators/healthVectors.validator';

const router = Router();

// Todas las rutas requieren autenticación (HU-25 CA2 — GET autenticado)
router.use(authenticate);

// Lectura — cualquier usuario autenticado (RF-26, HU-25)
router.get('/', validate(listRules), healthVectorsController.list);
router.get('/:id', validate(idParamRule), healthVectorsController.getById);

// Mutaciones — ADMIN y COORDINADOR_LOGISTICA (HU-25 CA2)
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createRules),
  healthVectorsController.create,
);

router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateRules]),
  healthVectorsController.update,
);

// HU-25 CA3 — actualizar estado + actions_taken
router.put(
  '/:id/status',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...setStatusRules]),
  healthVectorsController.setStatus,
);

// Eliminar — solo ADMIN
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate(idParamRule),
  healthVectorsController.remove,
);

export default router;
