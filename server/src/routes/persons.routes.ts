import { Router } from 'express';
import * as personsController from '../controllers/persons.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPersonRules,
  updatePersonRules,
  searchByDocumentRules,
  idParamRule,
} from '../validators/persons.validator';

const router = Router();

router.use(authenticate);

// Read-only — any authenticated user
router.get('/search', validate(searchByDocumentRules), personsController.findByDocument);

// Mutations — ADMIN/COORDINADOR_LOGISTICA/CENSADOR (censan en campo — RF-08)
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  validate(createPersonRules),
  personsController.create,
);
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  validate([...idParamRule, ...updatePersonRules]),
  personsController.update,
);
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  personsController.remove,
);

export default router;
