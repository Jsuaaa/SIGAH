import { Router } from 'express';
import * as controller from '../controllers/reports.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  inventoryRules,
  unattendedFamiliesRules,
  donationsByTypeRules,
  deliveriesByZoneRules,
  dashboardRules,
  traceabilityRules,
} from '../validators/reports.validator';

const router = Router();

// All report endpoints require authentication and one of these roles.
// RF-28: ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL.
router.use(authenticate);
router.use(authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'FUNCIONARIO_CONTROL'));

/**
 * @swagger
 * /reports/coverage:
 *   get:
 *     tags: [Reports]
 *     summary: Cobertura vigente por zona (ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL)
 *     responses:
 *       200:
 *         description: Porcentaje de cobertura de ayuda por zona
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
 *                       zone_id: { type: integer }
 *                       zone_name: { type: string }
 *                       total_families: { type: integer }
 *                       families_with_coverage: { type: integer }
 *                       coverage_pct: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/coverage', controller.coverage);

/**
 * @swagger
 * /reports/inventory:
 *   get:
 *     tags: [Reports]
 *     summary: Inventario por bodega y categoría (ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL)
 *     parameters:
 *       - in: query
 *         name: warehouse_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por bodega
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION] }
 *         description: Filtrar por categoría
 *     responses:
 *       200:
 *         description: Reporte de inventario
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
 *                       category: { type: string }
 *                       total_quantity: { type: string }
 *                       total_weight_kg: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/inventory', validate(inventoryRules), controller.inventory);

/**
 * @swagger
 * /reports/unattended-families:
 *   get:
 *     tags: [Reports]
 *     summary: Familias sin cobertura de ayuda (ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL)
 *     parameters:
 *       - in: query
 *         name: zone_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por zona
 *       - in: query
 *         name: since
 *         schema: { type: string, format: date }
 *         description: Sin entrega desde esta fecha
 *     responses:
 *       200:
 *         description: Familias sin cobertura activa
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
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/unattended-families', validate(unattendedFamiliesRules), controller.unattendedFamilies);

/**
 * @swagger
 * /reports/donations-by-type:
 *   get:
 *     tags: [Reports]
 *     summary: Donaciones agrupadas por tipo de donante con exportación
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Fecha inicio
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Fecha fin
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf, xlsx] }
 *         description: Formato de exportación
 *     responses:
 *       200:
 *         description: Donaciones por tipo de donante (JSON) o archivo binario (PDF/XLSX)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/donations-by-type', validate(donationsByTypeRules), controller.donationsByType);

/**
 * @swagger
 * /reports/deliveries-by-zone:
 *   get:
 *     tags: [Reports]
 *     summary: Entregas por zona con conteo y peso con exportación
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Fecha inicio
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Fecha fin
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf, xlsx] }
 *         description: Formato de exportación
 *     responses:
 *       200:
 *         description: Entregas agrupadas por zona
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/deliveries-by-zone', validate(deliveriesByZoneRules), controller.deliveriesByZone);

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Dashboard de métricas generales con exportación
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf, xlsx] }
 *         description: Formato de exportación
 *     responses:
 *       200:
 *         description: Métricas del dashboard (familias, entregas, inventario, donaciones)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/dashboard', validate(dashboardRules), controller.dashboard);

/**
 * @swagger
 * /reports/traceability:
 *   get:
 *     tags: [Reports]
 *     summary: Trazabilidad donante → bodega → entrega → familia
 *     parameters:
 *       - in: query
 *         name: donation_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Trazar por donación específica
 *       - in: query
 *         name: resource_type_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Trazar por tipo de recurso
 *     responses:
 *       200:
 *         description: Cadena de trazabilidad completa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/traceability', validate(traceabilityRules), controller.traceability);

export default router;
