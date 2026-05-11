import { Router } from 'express';
import * as donationsController from '../controllers/donations.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createDonationRules,
  listDonationRules,
  idParamRule,
} from '../validators/donations.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /donations:
 *   get:
 *     tags: [Donations]
 *     summary: Listar donaciones paginadas
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: donor_id
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrar por donante
 *       - in: query
 *         name: donation_type
 *         schema: { type: string, enum: [IN_KIND, MONETARY, MIXED] }
 *         description: Filtrar por tipo
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Fecha inicio (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Fecha fin (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Lista paginada de donaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Donation' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', validate(listDonationRules), donationsController.list);

/**
 * @swagger
 * /donations/{id}:
 *   get:
 *     tags: [Donations]
 *     summary: Obtener donación por ID con detalles
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Donación con detalles de recursos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Donation' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), donationsController.getById);

/**
 * @swagger
 * /donations:
 *   post:
 *     tags: [Donations]
 *     summary: Registrar donación (ADMIN, COORDINADOR_LOGISTICA, REGISTRADOR_DONACIONES)
 *     description: Al crear, si hay detalles IN_KIND, actualiza inventario de la bodega destino.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donor_id, donation_type, date]
 *             properties:
 *               donor_id: { type: integer, minimum: 1 }
 *               destination_warehouse_id: { type: integer, minimum: 1, nullable: true }
 *               donation_type: { type: string, enum: [IN_KIND, MONETARY, MIXED] }
 *               monetary_amount: { type: string, nullable: true, description: 'Monto en COP (para MONETARY o MIXED)' }
 *               date: { type: string, format: date }
 *               notes: { type: string, nullable: true }
 *               details:
 *                 type: array
 *                 description: Requerido si donation_type es IN_KIND o MIXED
 *                 items:
 *                   type: object
 *                   required: [resource_type_id, quantity]
 *                   properties:
 *                     resource_type_id: { type: integer, minimum: 1 }
 *                     quantity: { type: number, minimum: 1 }
 *                     batch: { type: string, nullable: true }
 *                     expiration_date: { type: string, format: date, nullable: true }
 *     responses:
 *       201:
 *         description: Donación registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Donation' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'),
  validate(createDonationRules),
  donationsController.create,
);

export default router;
