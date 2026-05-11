import { Router } from 'express';
import * as donorsController from '../controllers/donors.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createDonorRules,
  updateDonorRules,
  idParamRule,
} from '../validators/donors.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /donors:
 *   get:
 *     tags: [Donors]
 *     summary: Listar donantes
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PERSONA_NATURAL, EMPRESA, ALCALDIA, GOBERNACION, ORGANIZACION] }
 *         description: Filtrar por tipo de donante
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Filtrar activos/inactivos
 *     responses:
 *       200:
 *         description: Lista paginada de donantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Donor' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', donorsController.list);

/**
 * @swagger
 * /donors/{id}:
 *   get:
 *     tags: [Donors]
 *     summary: Obtener donante por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Donante encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Donor' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), donorsController.getById);

/**
 * @swagger
 * /donors/{id}/donations:
 *   get:
 *     tags: [Donors]
 *     summary: Listar donaciones de un donante
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Donaciones del donante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Donation' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/donations', validate(idParamRule), donorsController.listDonations);

/**
 * @swagger
 * /donors:
 *   post:
 *     tags: [Donors]
 *     summary: Crear donante (ADMIN, COORDINADOR_LOGISTICA, REGISTRADOR_DONACIONES)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, contact]
 *             properties:
 *               name: { type: string }
 *               type: { type: string, enum: [PERSONA_NATURAL, EMPRESA, ALCALDIA, GOBERNACION, ORGANIZACION] }
 *               contact: { type: string }
 *               tax_id: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Donante creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Donor' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'),
  validate(createDonorRules),
  donorsController.create,
);

/**
 * @swagger
 * /donors/{id}:
 *   put:
 *     tags: [Donors]
 *     summary: Actualizar donante (ADMIN, COORDINADOR_LOGISTICA, REGISTRADOR_DONACIONES)
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
 *               type: { type: string, enum: [PERSONA_NATURAL, EMPRESA, ALCALDIA, GOBERNACION, ORGANIZACION] }
 *               contact: { type: string }
 *               tax_id: { type: string, nullable: true }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Donante actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Donor' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'),
  validate([...idParamRule, ...updateDonorRules]),
  donorsController.update,
);

/**
 * @swagger
 * /donors/{id}:
 *   delete:
 *     tags: [Donors]
 *     summary: Eliminar donante (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Donante eliminado
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
  donorsController.remove,
);

export default router;
