import { body, param, query } from 'express-validator';
import { FAMILY_STATUSES } from '../types/entities';

const FAMILY_STATUS_VALUES = FAMILY_STATUSES as unknown as string[];

export const createFamilyRules = [
  body('head_document')
    .isString()
    .withMessage('head_document must be a string')
    .trim()
    .isLength({ min: 5, max: 30 })
    .withMessage('head_document must be between 5 and 30 characters'),

  body('zone_id')
    .isInt({ min: 1 })
    .withMessage('zone_id must be a positive integer')
    .toInt(),

  body('shelter_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('shelter_id must be a positive integer')
    .toInt(),

  body('num_members')
    .isInt({ min: 1 })
    .withMessage('num_members must be greater than 0')
    .toInt(),

  body('num_children_under_5')
    .optional()
    .isInt({ min: 0 })
    .toInt(),

  body('num_adults_over_65').optional().isInt({ min: 0 }).toInt(),
  body('num_pregnant').optional().isInt({ min: 0 }).toInt(),
  body('num_disabled').optional().isInt({ min: 0 }).toInt(),

  body('status')
    .optional()
    .isIn(FAMILY_STATUS_VALUES)
    .withMessage(`status must be one of: ${FAMILY_STATUSES.join(', ')}`),

  body('latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),

  body('reference_address')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 250 }),

  // RN-09: privacy consent must be present and TRUE. The SP also enforces
  // this, but rejecting at the validator surface gives a clean 400 instead of
  // a 422 round-trip.
  body('privacy_consent_accepted')
    .exists({ values: 'null' })
    .withMessage('privacy_consent_accepted is required (RN-09, Ley 1581/2012)')
    .bail()
    .isBoolean()
    .withMessage('privacy_consent_accepted must be a boolean')
    .bail()
    .custom((v: boolean) => v === true)
    .withMessage('privacy_consent_accepted must be true (RN-09)'),
];

export const updateFamilyRules = [
  body('head_document').optional().isString().trim().isLength({ min: 5, max: 30 }),
  body('zone_id').optional().isInt({ min: 1 }).toInt(),
  body('shelter_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('status').optional().isIn(FAMILY_STATUS_VALUES),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('reference_address').optional({ nullable: true }).isString().trim().isLength({ max: 250 }),
];

export const searchRules = [
  query('q')
    .isString()
    .withMessage('q must be a string')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('q must be between 2 and 80 characters'),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
