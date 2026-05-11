import { body, param, query } from 'express-validator';
import { DELIVERY_STATUSES } from '../types/entities';

const STATUS_VALUES = DELIVERY_STATUSES as unknown as string[];

export const listDeliveryRules = [
  query('family_id').optional().isInt({ min: 1 }).toInt(),
  query('warehouse_id').optional().isInt({ min: 1 }).toInt(),
  query('status').optional().isIn(STATUS_VALUES),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
];

export const eligibilityRules = [
  query('family_id')
    .exists()
    .withMessage('family_id is required')
    .bail()
    .isInt({ min: 1 })
    .withMessage('family_id must be a positive integer')
    .toInt(),
];

export const createExceptionRules = [
  body('family_id').isInt({ min: 1 }).toInt(),
  body('source_warehouse_id').isInt({ min: 1 }).toInt(),
  body('coverage_days')
    .isInt({ min: 3 })
    .withMessage('coverage_days must be >= 3 (RN-01)')
    .toInt(),
  body('exception_reason')
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('exception_reason is required (HU-23 CA5)'),
  body('exception_authorized_by')
    .isInt({ min: 1 })
    .withMessage('exception_authorized_by must be a positive integer')
    .toInt(),
  body('received_by_document').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('delivery_latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('client_op_id').optional({ nullable: true }).isString().trim().isLength({ min: 8, max: 80 }),

  body('details')
    .isArray({ min: 1 })
    .withMessage('details must be a non-empty array'),
  body('details.*.resource_type_id').isInt({ min: 1 }).toInt(),
  body('details.*.quantity').isInt({ gt: 0 }).toInt(),
  body('details.*.batch')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 60 }),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

// #24 CA1 — regular delivery creation rules (RN-01: coverage_days >= 3).
export const createDeliveryRules = [
  body('family_id').isInt({ min: 1 }).toInt(),
  body('source_warehouse_id').isInt({ min: 1 }).toInt(),
  body('coverage_days')
    .isInt({ min: 3 })
    .withMessage('coverage_days must be >= 3 (RN-01)')
    .toInt(),
  body('received_by_document').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('delivery_latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('client_op_id').optional({ nullable: true }).isString().trim().isLength({ min: 8, max: 80 }),
  body('details')
    .isArray({ min: 1 })
    .withMessage('details must be a non-empty array'),
  body('details.*.resource_type_id').isInt({ min: 1 }).toInt(),
  body('details.*.quantity').isInt({ gt: 0 }).toInt(),
  body('details.*.batch')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 60 }),
];

// #24 CA6 — status transition rule.
export const updateStatusRules = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  body('status')
    .isIn(STATUS_VALUES)
    .withMessage(`status must be one of ${STATUS_VALUES.join(', ')}`),
];

// #24 CA4 — batch creation rule.
export const batchRules = [
  body('count')
    .isInt({ min: 1, max: 100 })
    .withMessage('count must be an integer between 1 and 100')
    .toInt(),
];
