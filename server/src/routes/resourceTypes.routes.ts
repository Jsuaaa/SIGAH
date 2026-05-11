import { Router } from 'express';
import * as controller from '../controllers/resourceTypes.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createResourceTypeRules,
  updateResourceTypeRules,
  idParamRule,
} from '../validators/resourceTypes.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /resource-types:
 *   get:
 *     tags: [ResourceTypes]
 *     summary: Listar tipos de recursos
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION] }
 *         description: Filtrar por categoría
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Filtrar por activos/inactivos
 *     responses:
 *       200:
 *         description: Lista de tipos de recursos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ResourceType' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', controller.list);

/**
 * @swagger
 * /resource-types/{id}:
 *   get:
 *     tags: [ResourceTypes]
 *     summary: Obtener tipo de recurso por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Tipo de recurso encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ResourceType' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), controller.getById);

/**
 * @swagger
 * /resource-types:
 *   post:
 *     tags: [ResourceTypes]
 *     summary: Crear tipo de recurso (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, unit_of_measure, unit_weight_kg]
 *             properties:
 *               name: { type: string }
 *               category: { type: string, enum: [FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION] }
 *               unit_of_measure: { type: string }
 *               unit_weight_kg: { type: number, minimum: 0 }
 *     responses:
 *       201:
 *         description: Tipo de recurso creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ResourceType' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createResourceTypeRules),
  controller.create,
);

/**
 * @swagger
 * /resource-types/{id}:
 *   put:
 *     tags: [ResourceTypes]
 *     summary: Actualizar tipo de recurso (ADMIN o COORDINADOR_LOGISTICA)
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
 *               category: { type: string, enum: [FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION] }
 *               unit_of_measure: { type: string }
 *               unit_weight_kg: { type: number, minimum: 0 }
 *     responses:
 *       200:
 *         description: Tipo de recurso actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ResourceType' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateResourceTypeRules]),
  controller.update,
);

/**
 * @swagger
 * /resource-types/{id}:
 *   delete:
 *     tags: [ResourceTypes]
 *     summary: Desactivar tipo de recurso - soft delete (ADMIN o COORDINADOR_LOGISTICA)
 *     description: No elimina físicamente el registro para preservar integridad histórica (HU-14 CA4).
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Tipo de recurso desactivado
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
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(idParamRule),
  controller.remove,
);

export default router;
