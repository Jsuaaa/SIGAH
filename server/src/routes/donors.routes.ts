import { Router } from 'express';
import * as donorsController from '../controllers/donors.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createDonorRules,
  updateDonorRules,
  idParamRule,
} from '../validators/donors.validator';

const router = Router();

router.use(authenticate);

router.get('/', donorsController.list);
router.get('/:id', validate(idParamRule), donorsController.getById);
router.get('/:id/donations', validate(idParamRule), donorsController.listDonations);

// Mutaciones — ADMIN/COORDINADOR_LOGISTICA/REGISTRADOR_DONACIONES (HU-19)
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'),
  validate(createDonorRules),
  donorsController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'),
  validate([...idParamRule, ...updateDonorRules]),
  donorsController.update,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  donorsController.remove,
);

export default router;
