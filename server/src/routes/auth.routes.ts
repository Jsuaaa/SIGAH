import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { loginRules, registerRules, changePasswordRules } from '../validators/auth.validator';

const router = Router();

// Public
router.post('/login', validate(loginRules), authController.login);

// Protected - requires authentication
router.get('/me', authenticate, authController.getProfile);
router.put('/change-password', authenticate, validate(changePasswordRules), authController.changePassword);

// Admin only
router.post('/register', authenticate, authorize('ADMIN'), validate(registerRules), authController.register);

export default router;
