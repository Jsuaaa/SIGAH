import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  loginRules,
  registerRules,
  changePasswordRules,
  resetPasswordRules,
  updateUserRules,
  listUsersRules,
} from '../validators/auth.validator';

const router = Router();

// -----------------------------------------------------------------------
// Público
// -----------------------------------------------------------------------

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login con email y password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: JWT token + datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       423: { $ref: '#/components/responses/Locked' }
 */
router.post('/login', validate(loginRules), authController.login);

// -----------------------------------------------------------------------
// Requiere autenticación
// -----------------------------------------------------------------------

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener perfil del usuario autenticado
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Cambiar contraseña propia
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Contraseña cambiada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordRules),
  authController.changePassword,
);

// -----------------------------------------------------------------------
// Solo ADMIN
// -----------------------------------------------------------------------

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario (solo ADMIN)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, role]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CENSADOR, OPERADOR_ENTREGAS, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL, REGISTRADOR_DONACIONES]
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/register',
  authenticate,
  authorize('ADMIN'),
  validate(registerRules),
  authController.register,
);

/**
 * @swagger
 * /auth/reset-password/{userId}:
 *   post:
 *     tags: [Auth]
 *     summary: Resetear contraseña de un usuario (solo ADMIN)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID del usuario a resetear
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [new_password]
 *             properties:
 *               new_password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Contraseña reseteada
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
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/reset-password/:userId',
  authenticate,
  authorize('ADMIN'),
  validate(resetPasswordRules),
  authController.resetPassword,
);

/**
 * @swagger
 * /auth/users/{id}:
 *   put:
 *     tags: [Auth]
 *     summary: Editar role, name y/o is_active de un usuario (solo ADMIN, HU-01 CA1)
 *     description: >
 *       Actualización parcial. Se puede enviar cualquier combinación de role, name
 *       e is_active. Al menos uno debe estar presente. Email y contraseña NO se
 *       pueden modificar por esta vía.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CENSADOR, OPERADOR_ENTREGAS, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL, REGISTRADOR_DONACIONES]
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 120
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  '/users/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateUserRules),
  authController.updateUser,
);

/**
 * @swagger
 * /auth/users:
 *   get:
 *     tags: [Auth]
 *     summary: Listado paginado de usuarios (solo ADMIN)
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, CENSADOR, OPERADOR_ENTREGAS, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL, REGISTRADOR_DONACIONES]
 *         description: Filtrar por rol
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Filtrar por estado activo
 *     responses:
 *       200:
 *         description: Lista paginada de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/users',
  authenticate,
  authorize('ADMIN'),
  validate(listUsersRules),
  authController.listUsers,
);

export default router;
