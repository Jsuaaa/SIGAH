import { Router } from 'express';
import * as controller from '../controllers/relocations.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { applyRules, listRules, idParamRule } from '../validators/relocations.validator';

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authenticate);

/**
 * @swagger
 * /relocations:
 *   get:
 *     tags: [Relocations]
 *     summary: Listar reubicaciones de familias
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: family_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por familia
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [TEMPORARY, PERMANENT] }
 *         description: Filtrar por tipo de reubicación
 *     responses:
 *       200:
 *         description: Lista paginada de reubicaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Relocation' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', validate(listRules), controller.list);

/**
 * @swagger
 * /relocations/{id}:
 *   get:
 *     tags: [Relocations]
 *     summary: Obtener reubicación por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Reubicación con datos enriquecidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Relocation' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), controller.getById);

/**
 * @swagger
 * /relocations:
 *   post:
 *     tags: [Relocations]
 *     summary: Reubicar familia entre refugios (ADMIN o COORDINADOR_LOGISTICA)
 *     description: Actualiza shelter_id de la familia y registra el historial de reubicación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [family_id, destination_shelter_id, type, reason]
 *             properties:
 *               family_id: { type: integer, minimum: 1 }
 *               destination_shelter_id: { type: integer, minimum: 1 }
 *               type: { type: string, enum: [TEMPORARY, PERMANENT] }
 *               reason: { type: string }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Reubicación registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Relocation' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(applyRules),
  controller.apply,
);

export default router;
