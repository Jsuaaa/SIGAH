import { body } from 'express-validator';

export const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const registerRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .isIn(['ADMIN', 'COORDINATOR', 'OPERATOR', 'VIEWER'])
    .withMessage('Role must be ADMIN, COORDINATOR, OPERATOR, or VIEWER'),
];

export const changePasswordRules = [
  body('oldPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];
