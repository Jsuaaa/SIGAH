import { body, param, query } from 'express-validator';
import { VECTOR_TYPES, HEALTH_VECTOR_STATUSES, RISK_LEVELS } from '../types/entities';

const VECTOR_TYPE_VALUES  = VECTOR_TYPES            as unknown as string[];
const STATUS_VALUES       = HEALTH_VECTOR_STATUSES  as unknown as string[];
const RISK_LEVEL_VALUES   = RISK_LEVELS             as unknown as string[];

// RF-26 / HU-25 CA1 — vector_type y risk_level obligatorios en creación.
export const createRules = [
  body('vector_type')
    .isIn(VECTOR_TYPE_VALUES)
    .withMessage(`vector_type must be one of: ${VECTOR_TYPES.join(', ')} (RF-26 CA1)`),

  body('risk_level')
    .isIn(RISK_LEVEL_VALUES)
    .withMessage(`risk_level must be one of: ${RISK_LEVELS.join(', ')}`),

  body('description')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),

  body('actions_taken')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),

  body('latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),

  body('zone_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .toInt()
    .withMessage('zone_id must be a positive integer'),

  body('shelter_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .toInt()
    .withMessage('shelter_id must be a positive integer'),

  body('reported_date')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('reported_date must be a valid ISO-8601 date'),
];

// Campos editables en PUT /:id (todos opcionales).
export const updateRules = [
  body('description')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),

  body('actions_taken')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),

  body('risk_level')
    .optional()
    .isIn(RISK_LEVEL_VALUES)
    .withMessage(`risk_level must be one of: ${RISK_LEVELS.join(', ')}`),

  body('latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),

  body('zone_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .toInt()
    .withMessage('zone_id must be a positive integer'),

  body('shelter_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .toInt()
    .withMessage('shelter_id must be a positive integer'),
];

// HU-25 CA3 — PUT /:id/status: status obligatorio.
export const setStatusRules = [
  body('status')
    .isIn(STATUS_VALUES)
    .withMessage(`status must be one of: ${HEALTH_VECTOR_STATUSES.join(', ')} (HU-25 CA3)`),

  body('actions_taken')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
];

// Filtros de listado.
export const listRules = [
  query('zone_id')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('zone_id must be a positive integer'),

  query('shelter_id')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('shelter_id must be a positive integer'),

  query('risk_level')
    .optional()
    .isIn(RISK_LEVEL_VALUES)
    .withMessage(`risk_level must be one of: ${RISK_LEVELS.join(', ')}`),

  query('vector_type')
    .optional()
    .isIn(VECTOR_TYPE_VALUES)
    .withMessage(`vector_type must be one of: ${VECTOR_TYPES.join(', ')}`),

  query('status')
    .optional()
    .isIn(STATUS_VALUES)
    .withMessage(`status must be one of: ${HEALTH_VECTOR_STATUSES.join(', ')}`),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
