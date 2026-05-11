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

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     tags: [AuditLogs]
 *     summary: Consultar log de auditoría (solo ADMIN o FUNCIONARIO_CONTROL)
 *     description: Log inmutable. No hay endpoints de mutación; la tabla es append-only.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: module
 *         schema: { type: string }
 *         description: Filtrar por módulo (ej. families, deliveries)
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Filtrar por acción (ej. CREATE, UPDATE, DELETE)
 *       - in: query
 *         name: user_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por usuario
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Fecha inicio
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Fecha fin
 *     responses:
 *       200:
 *         description: Registros del log de auditoría
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AuditLog' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/',
  authorize('ADMIN', 'FUNCIONARIO_CONTROL'),
  validate(listAuditRules),
  controller.list,
);

export default router;
