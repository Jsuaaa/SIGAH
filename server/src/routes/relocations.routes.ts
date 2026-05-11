import { Router } from 'express';
import * as controller from '../controllers/relocations.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { applyRules, listRules, idParamRule } from '../validators/relocations.validator';

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authenticate);

// GET /api/v1/relocations — cualquier usuario autenticado puede listar (HU-24 CA4)
router.get('/', validate(listRules), controller.list);

// GET /api/v1/relocations/:id
router.get('/:id', validate(idParamRule), controller.getById);

// POST /api/v1/relocations — solo ADMIN y COORDINADOR_LOGISTICA (RF-15, HU-24)
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(applyRules),
  controller.apply,
);

export default router;
