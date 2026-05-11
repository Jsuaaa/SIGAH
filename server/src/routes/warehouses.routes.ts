import { Router } from 'express';
import * as warehousesController from '../controllers/warehouses.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createWarehouseRules,
  updateWarehouseRules,
  nearestRules,
  idParamRule,
} from '../validators/warehouses.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /warehouses/nearest:
 *   get:
 *     tags: [Warehouses]
 *     summary: Obtener bodega más cercana a coordenadas dadas
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *         description: Latitud
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *         description: Longitud
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 10, default: 1 }
 *         description: Cantidad de bodegas a retornar
 *     responses:
 *       200:
 *         description: Bodega(s) más cercana(s) con distancia en km
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - { $ref: '#/components/schemas/Warehouse' }
 *                       - type: object
 *                         properties:
 *                           distance_km: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/nearest', validate(nearestRules), warehousesController.nearest);

/**
 * @swagger
 * /warehouses:
 *   get:
 *     tags: [Warehouses]
 *     summary: Listar bodegas
 *     responses:
 *       200:
 *         description: Lista de bodegas con indicadores de ocupación
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
 */
router.get('/', warehousesController.list);

/**
 * @swagger
 * /warehouses/{id}:
 *   get:
 *     tags: [Warehouses]
 *     summary: Obtener bodega por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Bodega encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Warehouse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), warehousesController.getById);

/**
 * @swagger
 * /warehouses/{id}/inventory:
 *   get:
 *     tags: [Warehouses]
 *     summary: Listar inventario de una bodega
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Inventario de la bodega
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/InventoryRow' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/inventory', validate(idParamRule), warehousesController.inventory);

/**
 * @swagger
 * /warehouses:
 *   post:
 *     tags: [Warehouses]
 *     summary: Crear bodega (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address, zone_id, max_capacity_kg, latitude, longitude]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               zone_id: { type: integer, minimum: 1 }
 *               max_capacity_kg: { type: number, minimum: 1 }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       201:
 *         description: Bodega creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Warehouse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createWarehouseRules),
  warehousesController.create,
);

/**
 * @swagger
 * /warehouses/{id}:
 *   put:
 *     tags: [Warehouses]
 *     summary: Actualizar bodega (ADMIN o COORDINADOR_LOGISTICA)
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
 *               address: { type: string }
 *               zone_id: { type: integer, minimum: 1 }
 *               max_capacity_kg: { type: number, minimum: 1 }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       200:
 *         description: Bodega actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Warehouse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateWarehouseRules]),
  warehousesController.update,
);

/**
 * @swagger
 * /warehouses/{id}:
 *   delete:
 *     tags: [Warehouses]
 *     summary: Eliminar bodega (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Bodega eliminada
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
  warehousesController.remove,
);

export default router;
