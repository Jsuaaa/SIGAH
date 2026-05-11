import { Router } from 'express';
import * as controller from '../controllers/distributionPlans.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPlanRules,
  idParamRule,
  listPlanRules,
} from '../validators/distributionPlans.validator';

const router = Router();

// Todas las rutas requieren autenticación.
router.use(authenticate);

/**
 * @swagger
 * /distribution-plans:
 *   post:
 *     tags: [DistributionPlans]
 *     summary: Crear plan de distribución (ADMIN o COORDINADOR_LOGISTICA)
 *     description: Genera items para las familias elegibles según el alcance del plan.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scope]
 *             properties:
 *               scope: { type: string, enum: [GLOBAL, ZONA, REFUGIO, LOTE] }
 *               scope_id: { type: integer, minimum: 1, nullable: true, description: 'ID de zona/refugio/lote según scope' }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Plan creado con sus items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/DistributionPlan' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createPlanRules),
  controller.create,
);

/**
 * @swagger
 * /distribution-plans:
 *   get:
 *     tags: [DistributionPlans]
 *     summary: Listar planes de distribución
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PROGRAMADA, EN_EJECUCION, COMPLETADA, CANCELADA] }
 *         description: Filtrar por estado
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [GLOBAL, ZONA, REFUGIO, LOTE] }
 *         description: Filtrar por alcance
 *     responses:
 *       200:
 *         description: Lista paginada de planes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/DistributionPlan' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', validate(listPlanRules), controller.list);

/**
 * @swagger
 * /distribution-plans/{id}:
 *   get:
 *     tags: [DistributionPlans]
 *     summary: Obtener plan por ID con items embebidos
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Plan con sus items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   allOf:
 *                     - { $ref: '#/components/schemas/DistributionPlan' }
 *                     - type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/DistributionPlanItem' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), controller.getById);

/**
 * @swagger
 * /distribution-plans/{id}/cancel:
 *   put:
 *     tags: [DistributionPlans]
 *     summary: Cancelar plan de distribución (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Plan cancelado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/DistributionPlan' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.put(
  '/:id/cancel',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  controller.cancel,
);

/**
 * @swagger
 * /distribution-plans/{id}/execute:
 *   post:
 *     tags: [DistributionPlans]
 *     summary: Ejecutar plan (cambia estado a EN_EJECUCION) (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Plan en ejecución
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/DistributionPlan' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.post(
  '/:id/execute',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  controller.execute,
);

export default router;
