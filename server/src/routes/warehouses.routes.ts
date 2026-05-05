import { Router } from 'express';
import * as warehousesController from '../controllers/warehouses.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createWarehouseRules,
  updateWarehouseRules,
  nearestRules,
  idParamRule,
} from '../validators/warehouses.validator';

const router = Router();

router.use(authenticate);

// Read-only — any authenticated user
// Order matters: /nearest must come before /:id so it isn't shadowed.
router.get('/nearest', validate(nearestRules), warehousesController.nearest);
router.get('/', warehousesController.list);
router.get('/:id', validate(idParamRule), warehousesController.getById);
router.get('/:id/inventory', validate(idParamRule), warehousesController.inventory);

// Mutations — ADMIN or COORDINATOR
router.post(
  '/',
  authorize('ADMIN', 'COORDINATOR'),
  validate(createWarehouseRules),
  warehousesController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate([...idParamRule, ...updateWarehouseRules]),
  warehousesController.update,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate(idParamRule),
  warehousesController.remove,
);

export default router;
