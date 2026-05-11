import { Router } from 'express';
import * as healthVectorsController from '../controllers/healthVectors.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createRules,
  updateRules,
  setStatusRules,
  listRules,
  idParamRule,
} from '../validators/healthVectors.validator';

const router = Router();

// Todas las rutas requieren autenticación (HU-25 CA2 — GET autenticado)
router.use(authenticate);

/**
 * @swagger
 * /health-vectors:
 *   get:
 *     tags: [HealthVectors]
 *     summary: Listar vectores de riesgo sanitario
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: zone_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por zona
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVO, EN_ATENCION, RESUELTO] }
 *         description: Filtrar por estado
 *       - in: query
 *         name: risk_level
 *         schema: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *         description: Filtrar por nivel de riesgo
 *     responses:
 *       200:
 *         description: Lista de vectores sanitarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/HealthVector' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', validate(listRules), healthVectorsController.list);

/**
 * @swagger
 * /health-vectors/{id}:
 *   get:
 *     tags: [HealthVectors]
 *     summary: Obtener vector sanitario por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Vector sanitario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/HealthVector' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), healthVectorsController.getById);

/**
 * @swagger
 * /health-vectors:
 *   post:
 *     tags: [HealthVectors]
 *     summary: Reportar vector de riesgo sanitario (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vector_type, risk_level, reported_date]
 *             properties:
 *               vector_type: { type: string, enum: [AGUA_CONTAMINADA, INSECTOS, ROEDORES, OTRO] }
 *               risk_level: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               description: { type: string, nullable: true }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               zone_id: { type: integer, minimum: 1, nullable: true }
 *               shelter_id: { type: integer, minimum: 1, nullable: true }
 *               reported_date: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Vector registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/HealthVector' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createRules),
  healthVectorsController.create,
);

/**
 * @swagger
 * /health-vectors/{id}:
 *   put:
 *     tags: [HealthVectors]
 *     summary: Actualizar vector sanitario (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vector_type: { type: string, enum: [AGUA_CONTAMINADA, INSECTOS, ROEDORES, OTRO] }
 *               risk_level: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               description: { type: string, nullable: true }
 *               actions_taken: { type: string, nullable: true }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               zone_id: { type: integer, minimum: 1, nullable: true }
 *               shelter_id: { type: integer, minimum: 1, nullable: true }
 *     responses:
 *       200:
 *         description: Vector actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/HealthVector' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateRules]),
  healthVectorsController.update,
);

/**
 * @swagger
 * /health-vectors/{id}/status:
 *   put:
 *     tags: [HealthVectors]
 *     summary: Actualizar estado del vector + acciones tomadas (ADMIN o COORDINADOR_LOGISTICA)
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
 *               status: { type: string, enum: [ACTIVO, EN_ATENCION, RESUELTO] }
 *               actions_taken: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/HealthVector' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id/status',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...setStatusRules]),
  healthVectorsController.setStatus,
);

/**
 * @swagger
 * /health-vectors/{id}:
 *   delete:
 *     tags: [HealthVectors]
 *     summary: Eliminar vector sanitario (solo ADMIN)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Vector eliminado
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
  authorize('ADMIN'),
  validate(idParamRule),
  healthVectorsController.remove,
);

export default router;
