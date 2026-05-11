import { Router } from 'express';
import * as controller from '../controllers/inventory.controller';
import * as alertsController from '../controllers/alerts.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  upsertInventoryRules,
  adjustInventoryRules,
  idParamRule,
} from '../validators/inventory.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /inventory/summary:
 *   get:
 *     tags: [Inventory]
 *     summary: Resumen de inventario por bodega y categoría
 *     responses:
 *       200:
 *         description: Resumen agrupado de inventario
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
 *                       warehouse_id: { type: integer }
 *                       warehouse_name: { type: string }
 *                       category: { type: string, enum: [FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION], nullable: true }
 *                       total_quantity: { type: string }
 *                       total_weight_kg: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/summary', controller.summary);

/**
 * @swagger
 * /inventory/alerts:
 *   get:
 *     tags: [Inventory]
 *     summary: Alertas activas de inventario (stock bajo, vencimientos, bodega sobre 85%)
 *     responses:
 *       200:
 *         description: Lista de alertas de inventario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/InventoryAlert' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/alerts', alertsController.inventoryAlerts);

/**
 * @swagger
 * /inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: Listar inventario con filtros
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: warehouse_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por bodega
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION] }
 *         description: Filtrar por categoría
 *       - in: query
 *         name: expired
 *         schema: { type: boolean }
 *         description: Filtrar solo vencidos
 *     responses:
 *       200:
 *         description: Lista paginada de inventario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/InventoryRow' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', controller.list);

/**
 * @swagger
 * /inventory:
 *   post:
 *     tags: [Inventory]
 *     summary: Upsert de inventario en bodega (ADMIN o COORDINADOR_LOGISTICA)
 *     description: Si ya existe el lote, suma la cantidad; si no, crea el registro.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouse_id, resource_type_id, quantity, batch]
 *             properties:
 *               warehouse_id: { type: integer, minimum: 1 }
 *               resource_type_id: { type: integer, minimum: 1 }
 *               quantity: { type: number, minimum: 1 }
 *               batch: { type: string }
 *               expiration_date: { type: string, format: date, nullable: true }
 *     responses:
 *       200:
 *         description: Inventario actualizado o creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/InventoryRow' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(upsertInventoryRules),
  controller.upsert,
);

/**
 * @swagger
 * /inventory/{id}/adjustment:
 *   put:
 *     tags: [Inventory]
 *     summary: Ajuste manual de inventario (ADMIN o COORDINADOR_LOGISTICA)
 *     description: Permite correcciones por merma, daño, devolución o error.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [delta, reason, reason_note]
 *             properties:
 *               delta: { type: number, description: 'Cantidad a sumar (positivo) o restar (negativo)' }
 *               reason: { type: string, enum: [MERMA, DANO, DEVOLUCION, CORRECCION] }
 *               reason_note: { type: string }
 *     responses:
 *       200:
 *         description: Ajuste aplicado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/InventoryRow' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id/adjustment',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...adjustInventoryRules]),
  controller.adjust,
);

export default router;
