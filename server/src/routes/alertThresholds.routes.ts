import { Router } from 'express';
import * as alertsController from '../controllers/alerts.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { setThresholdRules } from '../validators/alerts.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /alert-thresholds:
 *   get:
 *     tags: [AlertThresholds]
 *     summary: Listar umbrales de alerta de inventario
 *     responses:
 *       200:
 *         description: Lista de umbrales con datos del recurso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AlertThreshold' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', alertsController.listThresholds);

/**
 * @swagger
 * /alert-thresholds:
 *   put:
 *     tags: [AlertThresholds]
 *     summary: Crear o actualizar umbral de alerta (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resource_type_id, min_quantity]
 *             properties:
 *               resource_type_id: { type: integer, minimum: 1 }
 *               min_quantity: { type: number, minimum: 0 }
 *     responses:
 *       200:
 *         description: Umbral creado o actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/AlertThreshold' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(setThresholdRules),
  alertsController.setThreshold,
);

export default router;
