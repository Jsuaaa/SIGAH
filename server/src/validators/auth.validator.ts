// auth.validator.ts — Validadores de forma para el módulo Auth.
// Justificación de reglas: HU-03 CA3 (min 8 chars), HU-01 CA1 (name requerido),
// RF-01 (roles del PDF). Las reglas de negocio (lockout, is_active) se verifican
// en el SP sp_auth_login, no aquí.

import { body, param, CustomValidator } from 'express-validator';
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
// Update user (ADMIN → any user) — HU-01 CA1
// Acepta role, name y/o is_active de forma parcial.
// Al menos uno debe estar presente (→ 422 si el body está vacío).
// No permite cambiar email ni contraseña por esta vía.
// -----------------------------------------------------------------------

// Validador personalizado: exige al menos uno de los tres campos editables.
const atLeastOneField: CustomValidator = (_value, { req }) => {
  const { role, name, is_active } = req.body as Record<string, unknown>;
  if (role === undefined && name === undefined && is_active === undefined) {
    throw new Error('At least one of role, name, or is_active must be provided');
  }
  return true;
};

export const updateUserRules = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer'),
  // role — opcional; si viene debe pertenecer al enum de 6 valores (RF-01)
  body('role')
    .optional()
    .isIn(ROLES as unknown as string[])
    .withMessage(`role must be one of: ${ROLES.join(', ')}`),
  // name — opcional; si viene: string con 2..120 caracteres (HU-01 CA1)
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),
  // is_active — opcional; si viene debe ser booleano
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  // Al menos un campo debe estar presente
  body().custom(atLeastOneField),
];

// Alias para compatibilidad con imports anteriores
export const setActiveRules = updateUserRules;

// -----------------------------------------------------------------------
// List users
// -----------------------------------------------------------------------
export const listUsersRules = [
  // Optional filters — validated loosely; the SP ignores invalid values via NULL
];
