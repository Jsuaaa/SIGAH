// Routes for map endpoints.
// All routes require authentication but NO role restriction (HU-29 AC6).

import { Router } from 'express';
import * as mapController from '../controllers/map.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamRule, daysQueryRule } from '../validators/map.validator';

const router = Router();

// All map endpoints require a valid JWT
router.use(authenticate);

/**
 * @swagger
 * /map/shelters:
 *   get:
 *     tags: [Map]
 *     summary: Datos geoespaciales de refugios para mapa
 *     responses:
 *       200:
 *         description: Refugios con coordenadas, ocupación y capacidad
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
 */
router.get('/shelters', mapController.shelters);

/**
 * @swagger
 * /map/warehouses:
 *   get:
 *     tags: [Map]
 *     summary: Datos geoespaciales de bodegas para mapa
 *     responses:
 *       200:
 *         description: Bodegas con coordenadas, porcentaje de stock y capacidad máxima
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
router.get('/warehouses', mapController.warehouses);

/**
 * @swagger
 * /map/families:
 *   get:
 *     tags: [Map]
 *     summary: Datos geoespaciales de familias para mapa (sin datos personales)
 *     responses:
 *       200:
 *         description: Familias con coordenadas, estado y priority_score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       latitude: { type: number, nullable: true }
 *                       longitude: { type: number, nullable: true }
 *                       status: { type: string, enum: [ACTIVO, EN_REFUGIO, EVACUADO] }
 *                       priority_score: { type: number }
 *                       zone_id: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/families', mapController.families);

/**
 * @swagger
 * /map/vectors:
 *   get:
 *     tags: [Map]
 *     summary: Datos geoespaciales de vectores sanitarios para mapa
 *     responses:
 *       200:
 *         description: Vectores con coordenadas, nivel de riesgo, estado y tipo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/HealthVector' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/vectors', mapController.vectors);

/**
 * @swagger
 * /map/zone/{id}:
 *   get:
 *     tags: [Map]
 *     summary: Datos agregados de una zona para mapa
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Entidades agregadas de la zona (refugios, familias, bodegas, vectores)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     zone: { $ref: '#/components/schemas/Zone' }
 *                     shelters:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Shelter' }
 *                     families:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Family' }
 *                     warehouses:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Warehouse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/zone/:id', validate(idParamRule), mapController.zoneAggregate);

/**
 * @swagger
 * /map/recent-deliveries:
 *   get:
 *     tags: [Map]
 *     summary: Entregas recientes con coordenadas para mapa
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, default: 7 }
 *         description: Número de días hacia atrás
 *     responses:
 *       200:
 *         description: Entregas ENTREGADA de los últimos N días con coordenadas
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
 */
router.get('/recent-deliveries', validate(daysQueryRule), mapController.recentDeliveries);

/**
 * @swagger
 * /map/zones-without-deliveries:
 *   get:
 *     tags: [Map]
 *     summary: Zonas sin entregas ENTREGADA en los últimos N días
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, default: 30 }
 *         description: Ventana de días a evaluar
 *     responses:
 *       200:
 *         description: Zonas sin cobertura de entrega en el período
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
router.get(
  '/zones-without-deliveries',
  validate(daysQueryRule),
  mapController.zonesWithoutDeliveries,
);

export default router;
