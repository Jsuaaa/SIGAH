import { body, param, query } from 'express-validator';
import { WAREHOUSE_STATUSES } from '../types/entities';

const STATUS_VALUES = WAREHOUSE_STATUSES as unknown as string[];

const baseRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),

  body('address')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('address must be between 3 and 200 characters'),

  body('zone_id')
    .isInt({ min: 1 })
    .withMessage('zone_id must be a positive integer')
    .toInt(),

  body('max_capacity_kg')
    .isFloat({ gt: 0 })
    .withMessage('max_capacity_kg must be greater than 0')
    .toFloat(),

  body('current_weight_kg')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('current_weight_kg must be >= 0')
    .toFloat(),

  body('status')
    .optional()
    .isIn(STATUS_VALUES)
    .withMessage(`status must be one of: ${WAREHOUSE_STATUSES.join(', ')}`),

  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),
];

export const createWarehouseRules = [...baseRules];

export const updateWarehouseRules = baseRules.map((rule) => rule.optional());

export const nearestRules = [
  query('lat')
    .exists()
    .withMessage('lat is required')
    .bail()
    .isFloat({ min: -90, max: 90 })
    .toFloat(),
  query('lng')
    .exists()
    .withMessage('lng is required')
    .bail()
    .isFloat({ min: -180, max: 180 })
    .toFloat(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
