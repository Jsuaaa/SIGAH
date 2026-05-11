import { Router } from 'express';
import * as familiesController from '../controllers/families.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import {
  createFamilyRules,
  updateFamilyRules,
  searchRules,
  idParamRule,
} from '../validators/families.validator';

const router = Router();

router.use(authenticate);

// Read-only — any authenticated user
router.get('/search', validate(searchRules), familiesController.search);
router.get('/', familiesController.list);
router.get('/:id', validate(idParamRule), familiesController.getById);
router.get('/:id/eligibility', validate(idParamRule), familiesController.getEligibility);
router.get('/:id/persons', validate(idParamRule), familiesController.listPersons);
router.get('/:id/deliveries', validate(idParamRule), familiesController.listDeliveries);

// Registro de familias — CENSADOR (campo) + ADMIN + COORDINADOR_LOGISTICA (RF-06)
// idempotencyMiddleware: si Idempotency-Key ya fue procesada, retorna cache (#32/GH#48).
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  idempotencyMiddleware,
  validate(createFamilyRules),
  familiesController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  validate([...idParamRule, ...updateFamilyRules]),
  familiesController.update,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  familiesController.remove,
);

export default router;
