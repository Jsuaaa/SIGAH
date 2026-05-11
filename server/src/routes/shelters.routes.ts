import { Router } from 'express';
import * as sheltersController from '../controllers/shelters.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createShelterRules,
  updateShelterRules,
  occupancyRules,
  idParamRule,
} from '../validators/shelters.validator';

const router = Router();

router.use(authenticate);

// Read-only — any authenticated user
router.get('/', sheltersController.list);
router.get('/:id', validate(idParamRule), sheltersController.getById);

// Mutations — ADMIN or COORDINADOR_LOGISTICA (RF-05)
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createShelterRules),
  sheltersController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateShelterRules]),
  sheltersController.update,
);
// Ocupancy updates — también OPERADOR_ENTREGAS (trabaja en campo)
router.put(
  '/:id/occupancy',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'),
  validate([...idParamRule, ...occupancyRules]),
  sheltersController.setOccupancy,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  sheltersController.remove,
);

export default router;
