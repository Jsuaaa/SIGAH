import { Router } from 'express';
import * as familiesController from '../controllers/families.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
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

// Mutations — ADMIN or COORDINATOR (legacy v1 roles; #9.1 migrates these to
// CENSADOR/COORDINADOR_LOGISTICA but the v1 set is what existing tests use).
router.post(
  '/',
  authorize('ADMIN', 'COORDINATOR', 'OPERATOR'),
  validate(createFamilyRules),
  familiesController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate([...idParamRule, ...updateFamilyRules]),
  familiesController.update,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINATOR'),
  validate(idParamRule),
  familiesController.remove,
);

export default router;
