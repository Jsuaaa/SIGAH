import { Router } from 'express';
import * as controller from '../controllers/prioritization.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { rankingRules, nextBatchRules } from '../validators/prioritization.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /prioritization/ranking:
 *   get:
 *     tags: [Prioritization]
 *     summary: Ranking priorizado de familias
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
 *         description: Filtrar por estado de familia
 *     responses:
 *       200:
 *         description: Ranking de familias ordenado por priority_score descendente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/RankingRow' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/ranking', validate(rankingRules), controller.ranking);

/**
 * @swagger
 * /prioritization/next-batch:
 *   get:
 *     tags: [Prioritization]
 *     summary: Familias elegibles para el próximo lote de distribución
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: zone_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por zona
 *       - in: query
 *         name: limit_n
 *         schema: { type: integer, minimum: 1 }
 *         description: Número máximo de familias en el lote
 *     responses:
 *       200:
 *         description: Familias elegibles para el siguiente lote
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
 *                     description: RankingRow con campo eligibility
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/next-batch', validate(nextBatchRules), controller.nextBatch);

/**
 * @swagger
 * /prioritization/recalculate:
 *   post:
 *     tags: [Prioritization]
 *     summary: Recalcular scores de prioridad para todas las familias (ADMIN o COORDINADOR_LOGISTICA)
 *     description: Ejecuta sp_prioritization_recalculate_all en la BD. Puede tardar varios segundos.
 *     responses:
 *       200:
 *         description: Recálculo completado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post('/recalculate', authorize('ADMIN', 'COORDINADOR_LOGISTICA'), controller.recalculate);

export default router;
