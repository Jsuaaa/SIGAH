import { Router } from 'express';
import * as zonesController from '../controllers/zones.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createZoneRules, updateZoneRules, idParamRule } from '../validators/zones.validator';

const router = Router();

// All zone routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /zones:
 *   get:
 *     tags: [Zones]
 *     summary: Listar todas las zonas
 *     responses:
 *       200:
 *         description: Lista de zonas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Zone' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', zonesController.list);

/**
 * @swagger
 * /zones/{id}:
 *   get:
 *     tags: [Zones]
 *     summary: Obtener zona por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Zona encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Zone' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), zonesController.getById);

/**
 * @swagger
 * /zones:
 *   post:
 *     tags: [Zones]
 *     summary: Crear zona (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, risk_level, latitude, longitude, estimated_population]
 *             properties:
 *               name: { type: string }
 *               risk_level: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               estimated_population: { type: integer, minimum: 0 }
 *     responses:
 *       201:
 *         description: Zona creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Zone' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createZoneRules),
  zonesController.create,
);

/**
 * @swagger
 * /zones/{id}:
 *   put:
 *     tags: [Zones]
 *     summary: Actualizar zona (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               risk_level: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               estimated_population: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Zona actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Zone' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateZoneRules]),
  zonesController.update,
);

/**
 * @swagger
 * /zones/{id}:
 *   delete:
 *     tags: [Zones]
 *     summary: Eliminar zona (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Zona eliminada
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
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  zonesController.remove,
);

/**
 * @swagger
 * /zones/{id}/families:
 *   get:
 *     tags: [Zones]
 *     summary: Listar familias de una zona
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Familias de la zona
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
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/families', validate(idParamRule), zonesController.listFamiliesByZone);

/**
 * @swagger
 * /zones/{id}/shelters:
 *   get:
 *     tags: [Zones]
 *     summary: Listar refugios de una zona
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Refugios de la zona
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Shelter' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/shelters', validate(idParamRule), zonesController.listSheltersByZone);

/**
 * @swagger
 * /zones/{id}/warehouses:
 *   get:
 *     tags: [Zones]
 *     summary: Listar bodegas de una zona
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Bodegas de la zona
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Warehouse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/warehouses', validate(idParamRule), zonesController.listWarehousesByZone);

export default router;
