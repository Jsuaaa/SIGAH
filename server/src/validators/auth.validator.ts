// auth.validator.ts — Validadores de forma para el módulo Auth.
// Justificación de reglas: HU-03 CA3 (min 8 chars), HU-01 CA1 (name requerido),
// RF-01 (roles del PDF). Las reglas de negocio (lockout, is_active) se verifican
// en el SP sp_auth_login, no aquí.

import { body, param } from 'express-validator';
import { ROLES } from '../types/entities';
import { MIN_PASSWORD_LENGTH } from '../config/constants';

// -----------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------
export const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// -----------------------------------------------------------------------
// Register (ADMIN only — HU-01)
// -----------------------------------------------------------------------
export const registerRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('password')
    .isLength({ min: MIN_PASSWORD_LENGTH })
    .withMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  body('role')
    .isIn(ROLES as unknown as string[])
    .withMessage(`Role must be one of: ${ROLES.join(', ')}`),
];

// -----------------------------------------------------------------------
// Change password (self-service)
// -----------------------------------------------------------------------
export const changePasswordRules = [
  body('oldPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: MIN_PASSWORD_LENGTH })
    .withMessage(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`),
];

// -----------------------------------------------------------------------
// Reset password (ADMIN → any user)
// -----------------------------------------------------------------------
export const resetPasswordRules = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('userId must be a positive integer'),
];

// -----------------------------------------------------------------------
// Set active (ADMIN → any user)
// -----------------------------------------------------------------------
export const setActiveRules = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer'),
  body('is_active')
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

// -----------------------------------------------------------------------
// List users
// -----------------------------------------------------------------------
export const listUsersRules = [
  // Optional filters — validated loosely; the SP ignores invalid values via NULL
];
