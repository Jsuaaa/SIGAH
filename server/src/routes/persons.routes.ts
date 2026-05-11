import { Router } from 'express';
import * as personsController from '../controllers/persons.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPersonRules,
  updatePersonRules,
  searchByDocumentRules,
  idParamRule,
} from '../validators/persons.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /persons/search:
 *   get:
 *     tags: [Persons]
 *     summary: Buscar persona por número de documento
 *     parameters:
 *       - in: query
 *         name: document
 *         required: true
 *         schema: { type: string }
 *         description: Número de documento de identidad
 *     responses:
 *       200:
 *         description: Persona encontrada con su familia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Person' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/search', validate(searchByDocumentRules), personsController.findByDocument);

/**
 * @swagger
 * /persons:
 *   post:
 *     tags: [Persons]
 *     summary: Registrar persona en una familia (ADMIN, COORDINADOR_LOGISTICA, CENSADOR)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [family_id, name, document, birth_date, gender, relationship]
 *             properties:
 *               family_id: { type: integer, minimum: 1 }
 *               name: { type: string }
 *               document: { type: string }
 *               birth_date: { type: string, format: date }
 *               gender: { type: string, enum: [M, F, OTRO] }
 *               relationship: { type: string, enum: [ESPOSO_A, HIJO_A, PADRE_MADRE, HERMANO_A, OTRO] }
 *               special_conditions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [CHILD_UNDER_5, ELDERLY_OVER_65, PREGNANT, DISABLED]
 *               requires_medication: { type: boolean }
 *     responses:
 *       201:
 *         description: Persona registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Person' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  validate(createPersonRules),
  personsController.create,
);

/**
 * @swagger
 * /persons/{id}:
 *   put:
 *     tags: [Persons]
 *     summary: Actualizar persona (ADMIN, COORDINADOR_LOGISTICA, CENSADOR)
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
 *               birth_date: { type: string, format: date }
 *               gender: { type: string, enum: [M, F, OTRO] }
 *               relationship: { type: string, enum: [ESPOSO_A, HIJO_A, PADRE_MADRE, HERMANO_A, OTRO] }
 *               special_conditions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [CHILD_UNDER_5, ELDERLY_OVER_65, PREGNANT, DISABLED]
 *               requires_medication: { type: boolean }
 *     responses:
 *       200:
 *         description: Persona actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Person' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/:id',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'),
  validate([...idParamRule, ...updatePersonRules]),
  personsController.update,
);

/**
 * @swagger
 * /persons/{id}:
 *   delete:
 *     tags: [Persons]
 *     summary: Eliminar persona (ADMIN o COORDINADOR_LOGISTICA)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Persona eliminada
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
  personsController.remove,
);

export default router;
