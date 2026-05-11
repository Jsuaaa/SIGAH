// auditLogs.validator.ts
// Reglas de validación para el endpoint GET /api/v1/audit-logs.
// Issue #47 (HU-31).

import { query } from 'express-validator';

export const listAuditRules = [
  query('user_id').optional().isInt({ min: 1 }).toInt(),
  query('entity_id').optional().isInt({ min: 1 }).toInt(),
  query('module').optional().isString().trim().isLength({ max: 100 }),
  query('action').optional().isString().trim().isLength({ max: 100 }),
  query('entity').optional().isString().trim().isLength({ max: 100 }),
  query('date_from').optional().isISO8601().withMessage('date_from must be a valid ISO 8601 date'),
  query('date_to').optional().isISO8601().withMessage('date_to must be a valid ISO 8601 date'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
];
