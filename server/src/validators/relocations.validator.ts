import { body, param, query } from 'express-validator';
import { RELOCATION_TYPES } from '../types/entities';

const TYPE_VALUES = RELOCATION_TYPES as unknown as string[];

// POST /api/v1/relocations — aplica un traslado (HU-24, RF-15)
export const applyRules = [
  body('family_id')
    .isInt({ min: 1 })
    .withMessage('family_id must be a positive integer')
    .toInt(),
  body('destination_shelter_id')
    .isInt({ min: 1 })
    .withMessage('destination_shelter_id must be a positive integer')
    .toInt(),
  body('type')
    .isIn(TYPE_VALUES)
    .withMessage(`type must be one of ${TYPE_VALUES.join(', ')}`),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('reason is required and must be between 5 and 1000 characters'),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('notes must be at most 2000 characters'),
];

// GET /api/v1/relocations — listado con filtros
export const listRules = [
  query('family_id').optional().isInt({ min: 1 }).toInt(),
  query('shelter_id').optional().isInt({ min: 1 }).toInt(),
  query('type').optional().isIn(TYPE_VALUES),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
];

// GET /api/v1/relocations/:id
export const idParamRule = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer')
    .toInt(),
];
