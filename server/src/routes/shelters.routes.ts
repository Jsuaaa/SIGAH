import { Router } from 'express';
import * as sheltersController from '../controllers/shelters.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createShelterRules,
  updateShelterRules,
  occupancyRules,
  idParamRule,
} from '../validators/shelters.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /shelters:
 *   get:
 *     tags: [Shelters]
 *     summary: Listar refugios con ocupación
 *     responses:
 *       200:
 *         description: Lista de refugios
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
router.get('/', sheltersController.list);

/**
 * @swagger
 * /shelters/{id}:
 *   get:
 *     tags: [Shelters]
 *     summary: Obtener refugio por ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Refugio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Shelter' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(idParamRule), sheltersController.getById);

/**
 * @swagger
 * /shelters:
 *   post:
 *     tags: [Shelters]
 *     summary: Crear refugio (ADMIN o COORDINADOR_LOGISTICA)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address, zone_id, max_capacity, type, latitude, longitude]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               zone_id: { type: integer, minimum: 1 }
 *               max_capacity: { type: integer, minimum: 1 }
 *               type:
 *                 type: string
 *                 enum: [SCHOOL, CHURCH, COMMUNITY_CENTER, STADIUM, TENT, OTHER]
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       201:
 *         description: Refugio creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Shelter' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(createShelterRules),
  sheltersController.create,
);

/**
 * @swagger
 * /shelters/{id}:
 *   put:
 *     tags: [Shelters]
 *     summary: Actualizar refugio (ADMIN o COORDINADOR_LOGISTICA)
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
 *               address: { type: string }
 *               zone_id: { type: integer, minimum: 1 }
 *               max_capacity: { type: integer, minimum: 1 }
 *               type:
 *                 type: string
 *                 enum: [SCHOOL, CHURCH, COMMUNITY_CENTER, STADIUM, TENT, OTHER]
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       200:
 *         description: Refugio actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Shelter' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate([...idParamRule, ...updateShelterRules]),
  sheltersController.update,
);

/**
 * @swagger
 * /shelters/{id}/occupancy:
 *   put:
 *     tags: [Shelters]
 *     summary: Actualizar ocupación del refugio (ADMIN, COORDINADOR_LOGISTICA, OPERADOR_ENTREGAS)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_occupancy]
 *             properties:
 *               current_occupancy: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Ocupación actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Shelter' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id/occupancy',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'),
  validate([...idParamRule, ...occupancyRules]),
  sheltersController.setOccupancy,
);

/**
 * @swagger
 * /shelters/{id}:
 *   delete:
 *     tags: [Shelters]
 *     summary: Eliminar refugio (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Refugio eliminado
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
  sheltersController.remove,
);

export default router;
