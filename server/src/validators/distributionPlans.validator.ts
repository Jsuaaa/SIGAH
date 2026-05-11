import { body, param, query } from 'express-validator';
import {
  DISTRIBUTION_PLAN_SCOPES,
  DISTRIBUTION_PLAN_STATUSES,
} from '../types/entities';

const SCOPE_VALUES = DISTRIBUTION_PLAN_SCOPES as unknown as string[];
const STATUS_VALUES = DISTRIBUTION_PLAN_STATUSES as unknown as string[];

/**
 * Reglas de validación para POST /distribution-plans.
 * Justificación:
 *   - scope obligatorio y en enum (RF-18, HU-21).
 *   - target_coverage_days >= 3 (RN-01).
 *   - scope_id obligatorio cuando scope=ZONA|REFUGIO.
 *   - family_ids (array de enteros) obligatorio cuando scope=LOTE.
 */
export const createPlanRules = [
  body('scope')
    .isIn(SCOPE_VALUES)
    .withMessage(`scope must be one of: ${SCOPE_VALUES.join(', ')}`),

  body('target_coverage_days')
    .isInt({ min: 3 })
    .withMessage('target_coverage_days must be an integer >= 3 (RN-01)')
    .toInt(),

  body('scope_id')
    .if(body('scope').isIn(['ZONA', 'REFUGIO']))
    .exists({ checkNull: true })
    .withMessage('scope_id is required when scope is ZONA or REFUGIO')
    .bail()
    .isInt({ min: 1 })
    .withMessage('scope_id must be a positive integer')
    .toInt(),

  body('scope_id')
    .if(body('scope').isIn(['GLOBAL', 'LOTE']))
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .toInt(),

  body('family_ids')
    .if(body('scope').equals('LOTE'))
    .isArray({ min: 1 })
    .withMessage('family_ids must be a non-empty array when scope is LOTE'),

  body('family_ids.*')
    .if(body('scope').equals('LOTE'))
    .isInt({ min: 1 })
    .withMessage('Each family_id must be a positive integer')
    .toInt(),

  body('notes')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
];

/** Regla de validación para /:id param. */
export const idParamRule = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer')
    .toInt(),
];

/** Filtros para GET /distribution-plans. */
export const listPlanRules = [
  query('status').optional().isIn(STATUS_VALUES).withMessage(`status must be one of: ${STATUS_VALUES.join(', ')}`),
  query('scope').optional().isIn(SCOPE_VALUES).withMessage(`scope must be one of: ${SCOPE_VALUES.join(', ')}`),
  query('created_by').optional().isInt({ min: 1 }).toInt(),
];
