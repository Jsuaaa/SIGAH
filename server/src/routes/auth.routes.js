const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { loginRules, registerRules, changePasswordRules } = require('../validators/auth.validator');

const router = Router();

// Public
router.post('/login', validate(loginRules), authController.login);

// Protected (auth middleware will be added in Issue #9)
router.post('/register', validate(registerRules), authController.register);
router.get('/me', authController.getProfile);
router.put('/change-password', validate(changePasswordRules), authController.changePassword);

module.exports = router;
