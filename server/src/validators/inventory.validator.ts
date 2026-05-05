import { body, param } from 'express-validator';
import { ADJUSTMENT_REASONS } from '../types/entities';

const REASON_VALUES = ADJUSTMENT_REASONS as unknown as string[];

export const upsertInventoryRules = [
  body('warehouse_id')
    .isInt({ min: 1 })
    .withMessage('warehouse_id must be a positive integer')
    .toInt(),
  body('resource_type_id')
    .isInt({ min: 1 })
    .withMessage('resource_type_id must be a positive integer')
    .toInt(),
  body('quantity')
    .isInt({ gt: 0 })
    .withMessage('quantity must be > 0')
    .toInt(),
  body('batch')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 60 }),
  body('expiration_date')
    .optional({ nullable: true })
    .isISO8601({ strict: true })
    .withMessage('expiration_date must be ISO-8601 (YYYY-MM-DD)'),
];

export const adjustInventoryRules = [
  body('delta')
    .exists({ values: 'null' })
    .withMessage('delta is required')
    .bail()
    .isInt()
    .withMessage('delta must be a non-zero integer')
    .toInt()
    .custom((v: number) => v !== 0)
    .withMessage('delta must be a non-zero integer'),
  body('reason')
    .isIn(REASON_VALUES)
    .withMessage(`reason must be one of: ${ADJUSTMENT_REASONS.join(', ')}`),
  body('reason_note')
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('reason_note must be between 3 and 500 characters'),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
