import { Router } from 'express';
import * as donationsController from '../controllers/donations.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createDonationRules,
  listDonationRules,
  idParamRule,
} from '../validators/donations.validator';

const router = Router();

router.use(authenticate);

router.get('/', validate(listDonationRules), donationsController.list);
router.get('/:id', validate(idParamRule), donationsController.getById);

// HU-19 — REGISTRADOR_DONACIONES + roles de gestión pueden crear donaciones.
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'),
  validate(createDonationRules),
  donationsController.create,
);

export default router;
