const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { loginRules, registerRules, changePasswordRules } = require('../validators/auth.validator');

const router = Router();

// Public
router.post('/login', validate(loginRules), authController.login);

// Protected - requires authentication
router.get('/me', authenticate, authController.getProfile);
router.put('/change-password', authenticate, validate(changePasswordRules), authController.changePassword);

// Admin only
router.post('/register', authenticate, authorize('ADMIN'), validate(registerRules), authController.register);

module.exports = router;
