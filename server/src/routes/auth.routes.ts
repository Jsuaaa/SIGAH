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
  setActiveRules,
  listUsersRules,
} from '../validators/auth.validator';

const router = Router();

// -----------------------------------------------------------------------
// Público
// -----------------------------------------------------------------------
router.post('/login', validate(loginRules), authController.login);

// -----------------------------------------------------------------------
// Requiere autenticación
// -----------------------------------------------------------------------
router.get('/me', authenticate, authController.getProfile);
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordRules),
  authController.changePassword,
);

// -----------------------------------------------------------------------
// Solo ADMIN
// -----------------------------------------------------------------------
router.post(
  '/register',
  authenticate,
  authorize('ADMIN'),
  validate(registerRules),
  authController.register,
);

// POST /auth/reset-password/:userId — Resetear contraseña de un usuario (HU-01 CA5)
router.post(
  '/reset-password/:userId',
  authenticate,
  authorize('ADMIN'),
  validate(resetPasswordRules),
  authController.resetPassword,
);

// PUT /auth/users/:id — Activar/desactivar usuario
router.put(
  '/users/:id',
  authenticate,
  authorize('ADMIN'),
  validate(setActiveRules),
  authController.setActive,
);

// GET /auth/users — Listado paginado de usuarios
router.get(
  '/users',
  authenticate,
  authorize('ADMIN'),
  validate(listUsersRules),
  authController.listUsers,
);

export default router;
