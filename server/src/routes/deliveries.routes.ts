import { Router } from 'express';
import * as controller from '../controllers/deliveries.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import {
  listDeliveryRules,
  eligibilityRules,
  createExceptionRules,
  createDeliveryRules,
  updateStatusRules,
  batchRules,
  idParamRule,
} from '../validators/deliveries.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /deliveries/eligibility:
 *   get:
 *     tags: [Deliveries]
 *     summary: Consultar elegibilidad de entrega para una familia
 *     parameters:
 *       - in: query
 *         name: family_id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID de la familia
 *     responses:
 *       200:
 *         description: Estado de elegibilidad de la familia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     is_eligible: { type: boolean }
 *                     reason: { type: string }
 *                     last_delivery_at: { type: string, format: date-time, nullable: true }
 *                     coverage_expires: { type: string, format: date-time, nullable: true }
 *                     days_remaining: { type: integer, nullable: true }
 *                     next_eligible_at: { type: string, format: date-time, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/eligibility', validate(eligibilityRules), controller.eligibility);

/**
 * @swagger
 * /deliveries:
 *   get:
 *     tags: [Deliveries]
 *     summary: Listar entregas paginadas
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: family_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por familia
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PROGRAMADA, EN_CURSO, ENTREGADA] }
 *         description: Filtrar por estado
 *       - in: query
 *         name: warehouse_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por bodega origen
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
 *         description: Lista paginada de entregas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Delivery' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', validate(listDeliveryRules), controller.list);

/**
 * @swagger
 * /deliveries/batch:
 *   post:
 *     tags: [Deliveries]
 *     summary: Crear múltiples entregas programadas desde un plan (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_id, items]
 *             properties:
 *               plan_id: { type: integer, minimum: 1 }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [family_id, source_warehouse_id, coverage_days]
 *                   properties:
 *                     family_id: { type: integer, minimum: 1 }
 *                     source_warehouse_id: { type: integer, minimum: 1 }
 *                     coverage_days: { type: integer, minimum: 3 }
 *                     details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [resource_type_id, quantity]
 *                         properties:
 *                           resource_type_id: { type: integer, minimum: 1 }
 *                           quantity: { type: number, minimum: 1 }
 *                           batch: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Lote de entregas creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     created: { type: integer }
 *                     deliveries:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Delivery' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/batch',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(batchRules),
  controller.createBatch,
);

/**
 * @swagger
 * /deliveries/exception:
 *   post:
 *     tags: [Deliveries]
 *     summary: Crear entrega con excepción a la regla de cobertura (solo COORDINADOR_LOGISTICA)
 *     description: Permite entregar a familia no elegible con justificación. Requiere exception_reason.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [family_id, source_warehouse_id, coverage_days, exception_reason, details]
 *             properties:
 *               family_id: { type: integer, minimum: 1 }
 *               source_warehouse_id: { type: integer, minimum: 1 }
 *               coverage_days: { type: integer, minimum: 3 }
 *               exception_reason: { type: string }
 *               notes: { type: string, nullable: true }
 *               delivery_latitude: { type: number, nullable: true }
 *               delivery_longitude: { type: number, nullable: true }
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [resource_type_id, quantity]
 *                   properties:
 *                     resource_type_id: { type: integer, minimum: 1 }
 *                     quantity: { type: number, minimum: 1 }
 *                     batch: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Entrega con excepción creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Delivery' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/exception',
  authorize('COORDINADOR_LOGISTICA'),
  validate(createExceptionRules),
  controller.createException,
);

/**
 * @swagger
 * /deliveries:
 *   post:
 *     tags: [Deliveries]
 *     summary: Crear entrega regular (ADMIN, COORDINADOR_LOGISTICA, OPERADOR_ENTREGAS)
 *     description: Valida elegibilidad de la familia antes de crear. Soporta idempotencia con Idempotency-Key.
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         required: false
 *         description: UUID v4 para idempotencia en redes inestables
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [family_id, source_warehouse_id, coverage_days, details]
 *             properties:
 *               family_id: { type: integer, minimum: 1 }
 *               source_warehouse_id: { type: integer, minimum: 1 }
 *               coverage_days: { type: integer, minimum: 3 }
 *               received_by_document: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               delivery_latitude: { type: number, nullable: true }
 *               delivery_longitude: { type: number, nullable: true }
 *               client_op_id: { type: string, nullable: true }
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [resource_type_id, quantity]
 *                   properties:
 *                     resource_type_id: { type: integer, minimum: 1 }
 *                     quantity: { type: number, minimum: 1 }
 *                     batch: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Entrega creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Delivery' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'),
  idempotencyMiddleware,
  validate(createDeliveryRules),
  controller.create,
);

/**
 * @swagger
 * /deliveries/{id}/status:
 *   put:
 *     tags: [Deliveries]
 *     summary: Actualizar estado de entrega (PROGRAMADA → EN_CURSO → ENTREGADA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [EN_CURSO, ENTREGADA] }
 *               received_by_document: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Delivery' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id/status',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'),
  validate(updateStatusRules),
  controller.updateStatus,
);

/**
 * @swagger
 * /deliveries/{id}:
 *   get:
 *     tags: [Deliveries]
 *     summary: Obtener entrega por ID con detalles
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Entrega con detalles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Delivery' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), controller.getById);

export default router;
