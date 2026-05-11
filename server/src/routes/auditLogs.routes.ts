// auditLogs.routes.ts
// Endpoints del log de auditoría inmutable (Issue #47, HU-31, RNF-09).
//
// GET /api/v1/audit-logs — restringido a ADMIN y FUNCIONARIO_CONTROL (HU-31 CA3).
// No hay endpoints de mutación: la tabla es append-only y solo los SPs la escriben.

import { Router } from 'express';
import * as controller from '../controllers/auditLogs.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { listAuditRules } from '../validators/auditLogs.validator';

const router = Router();

router.use(authenticate);

// HU-31 CA3: solo ADMIN y FUNCIONARIO_CONTROL pueden consultar el log.
router.get(
  '/',
  authorize('ADMIN', 'FUNCIONARIO_CONTROL'),
  validate(listAuditRules),
  controller.list,
);

export default router;
