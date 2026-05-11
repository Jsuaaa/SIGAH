/**
 * sync.routes.ts
 *
 * Routes:
 *   POST /api/v1/sync        — batch offline ops (all authenticated roles)
 *   GET  /api/v1/sync/status — sync statistics for the requesting user
 *
 * References: Issue #32 / GH #48.
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { processBatchRules } from '../validators/sync.validator';
import * as syncController from '../controllers/sync.controller';

const router = Router();

// All sync endpoints require authentication.
router.use(authenticate);

/**
 * @swagger
 * /sync/status:
 *   get:
 *     tags: [Sync]
 *     summary: Estado de sincronización del usuario actual
 *     description: Retorna estadísticas de operaciones offline procesadas/pendientes.
 *     responses:
 *       200:
 *         description: Estado de sincronización
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     processed: { type: integer }
 *                     failed: { type: integer }
 *                     last_sync_at: { type: string, format: date-time, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/status', syncController.status);

/**
 * @swagger
 * /sync:
 *   post:
 *     tags: [Sync]
 *     summary: Procesar lote de operaciones offline
 *     description: Recibe operaciones acumuladas sin conexión y las aplica en orden. Usa Idempotency-Key para cada op.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ops]
 *             properties:
 *               ops:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [idempotency_key, method, path, body]
 *                   properties:
 *                     idempotency_key: { type: string, format: uuid }
 *                     method: { type: string, enum: [POST, PUT, DELETE] }
 *                     path: { type: string, description: 'Ruta relativa al prefijo /api/v1' }
 *                     body: { type: object }
 *                     created_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Resultado del procesamiento del lote
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     processed: { type: integer }
 *                     failed: { type: integer }
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           idempotency_key: { type: string }
 *                           status: { type: integer }
 *                           body: { type: object }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', validate(processBatchRules), syncController.processBatch);

export default router;
