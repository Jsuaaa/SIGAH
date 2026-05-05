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

// Mutations — ADMIN or COORDINATOR only
router.post(
  '/',
  authorize('ADMIN', 'COORDINATOR'),
  validate(createShelterRules),
  sheltersController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate([...idParamRule, ...updateShelterRules]),
  sheltersController.update,
);
router.put(
  '/:id/occupancy',
  authorize('ADMIN', 'COORDINATOR', 'OPERATOR'),
  validate([...idParamRule, ...occupancyRules]),
  sheltersController.setOccupancy,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate(idParamRule),
  sheltersController.remove,
);

export default router;
