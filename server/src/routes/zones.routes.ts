import { Router } from 'express';
import * as zonesController from '../controllers/zones.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createZoneRules, updateZoneRules, idParamRule } from '../validators/zones.validator';

const router = Router();

// All zone routes require authentication
router.use(authenticate);

// Read-only — any authenticated user
router.get('/', zonesController.list);
router.get('/:id', validate(idParamRule), zonesController.getById);

// Mutations — ADMIN or COORDINATOR only
router.post('/', authorize('ADMIN', 'COORDINATOR'), validate(createZoneRules), zonesController.create);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate([...idParamRule, ...updateZoneRules]),
  zonesController.update,
);
router.delete('/:id', authorize('ADMIN', 'COORDINATOR'), validate(idParamRule), zonesController.remove);

// Nested stubs (real implementation deferred to issues #11, #12, #15)
router.get('/:id/families', validate(idParamRule), zonesController.listFamiliesByZone);
router.get('/:id/shelters', validate(idParamRule), zonesController.listSheltersByZone);
router.get('/:id/warehouses', validate(idParamRule), zonesController.listWarehousesByZone);

export default router;
