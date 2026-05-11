import { Router } from 'express';
import * as controller from '../controllers/scoringConfig.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { setScoringConfigRules } from '../validators/scoringConfig.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /scoring-config:
 *   get:
 *     tags: [ScoringConfig]
 *     summary: Obtener configuración de pesos del algoritmo de priorización
 *     responses:
 *       200:
 *         description: Configuración actual de scoring
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ScoringConfigRow' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', controller.list);

/**
 * @swagger
 * /scoring-config:
 *   put:
 *     tags: [ScoringConfig]
 *     summary: Actualizar pesos del algoritmo de priorización (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entries]
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, value]
 *                   properties:
 *                     key:
 *                       type: string
 *                       enum: [W_MEMBERS, W_CHILDREN_5, W_ADULTS_65, W_PREGNANT, W_DISABLED, W_ZONE_RISK, W_DAYS_NO_AID, W_DELIVERIES, MAX_DAYS]
 *                     value: { type: number }
 *     responses:
 *       200:
 *         description: Configuración actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ScoringConfigRow' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(setScoringConfigRules),
  controller.set,
);

export default router;
