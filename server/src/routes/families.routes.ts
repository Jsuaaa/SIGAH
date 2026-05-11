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

/**
 * @swagger
 * /families/search:
 *   get:
 *     tags: [Families]
 *     summary: Buscar familias por documento del jefe o código
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Término de búsqueda (documento o family_code)
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Family' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/search', validate(searchRules), familiesController.search);

/**
 * @swagger
 * /families:
 *   get:
 *     tags: [Families]
 *     summary: Listar familias paginadas
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: zone_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por zona
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVO, EN_REFUGIO, EVACUADO] }
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista paginada de familias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Family' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', familiesController.list);

/**
 * @swagger
 * /families/{id}:
 *   get:
 *     tags: [Families]
 *     summary: Obtener familia por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Familia encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Family' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), familiesController.getById);

/**
 * @swagger
 * /families/{id}/eligibility:
 *   get:
 *     tags: [Families]
 *     summary: Consultar elegibilidad de entrega de la familia
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Estado de elegibilidad
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
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/eligibility', validate(idParamRule), familiesController.getEligibility);

/**
 * @swagger
 * /families/{id}/persons:
 *   get:
 *     tags: [Families]
 *     summary: Listar personas de una familia
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Integrantes de la familia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Person' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/persons', validate(idParamRule), familiesController.listPersons);

/**
 * @swagger
 * /families/{id}/deliveries:
 *   get:
 *     tags: [Families]
 *     summary: Listar entregas de una familia
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Entregas de la familia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Delivery' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/deliveries', validate(idParamRule), familiesController.listDeliveries);

/**
 * @swagger
 * /families:
 *   post:
 *     tags: [Families]
 *     summary: Registrar nueva familia (ADMIN, COORDINADOR_LOGISTICA, CENSADOR)
 *     description: Soporta idempotencia mediante cabecera `Idempotency-Key`.
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         required: false
 *         description: UUID v4 para garantizar idempotencia en redes inestables
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [head_document, zone_id, num_members, privacy_consent_accepted]
 *             properties:
 *               head_document: { type: string }
 *               zone_id: { type: integer, minimum: 1 }
 *               shelter_id: { type: integer, minimum: 1, nullable: true }
 *               num_members: { type: integer, minimum: 1 }
 *               num_children_under_5: { type: integer, minimum: 0 }
 *               num_adults_over_65: { type: integer, minimum: 0 }
 *               num_pregnant: { type: integer, minimum: 0 }
 *               num_disabled: { type: integer, minimum: 0 }
 *               status: { type: string, enum: [ACTIVO, EN_REFUGIO, EVACUADO] }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               reference_address: { type: string, nullable: true }
 *               privacy_consent_accepted: { type: boolean, enum: [true] }
 *     responses:
 *       201:
 *         description: Familia registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Family' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  idempotencyMiddleware,
  validate(createFamilyRules),
  familiesController.create,
);

/**
 * @swagger
 * /families/{id}:
 *   put:
 *     tags: [Families]
 *     summary: Actualizar familia (ADMIN, COORDINADOR_LOGISTICA, CENSADOR)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               zone_id: { type: integer, minimum: 1 }
 *               shelter_id: { type: integer, minimum: 1, nullable: true }
 *               num_members: { type: integer, minimum: 1 }
 *               num_children_under_5: { type: integer, minimum: 0 }
 *               num_adults_over_65: { type: integer, minimum: 0 }
 *               num_pregnant: { type: integer, minimum: 0 }
 *               num_disabled: { type: integer, minimum: 0 }
 *               status: { type: string, enum: [ACTIVO, EN_REFUGIO, EVACUADO] }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               reference_address: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Familia actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Family' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  validate([...idParamRule, ...updateFamilyRules]),
  familiesController.update,
);

/**
 * @swagger
 * /families/{id}:
 *   delete:
 *     tags: [Families]
 *     summary: Eliminar familia (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Familia eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  familiesController.remove,
);

export default router;
