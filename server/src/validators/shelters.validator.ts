import { body, param } from 'express-validator';
import { SHELTER_TYPES } from '../types/entities';

const baseRules = [
  body('name')
    .isString()
    .withMessage('name must be a string')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),

  body('address')
    .isString()
    .withMessage('address must be a string')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('address must be between 3 and 200 characters'),

  body('zone_id')
    .isInt({ min: 1 })
    .withMessage('zone_id must be a positive integer')
    .toInt(),

  body('max_capacity')
    .isInt({ min: 1 })
    .withMessage('max_capacity must be a positive integer')
    .toInt(),

  body('current_occupancy')
    .optional()
    .isInt({ min: 0 })
    .withMessage('current_occupancy must be a non-negative integer')
    .toInt(),

  body('type')
    .isIn(SHELTER_TYPES as unknown as string[])
    .withMessage(`type must be one of: ${SHELTER_TYPES.join(', ')}`),

  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),
];

export const createShelterRules = [...baseRules];

// On update every field is optional, including current_occupancy which is
// already optional in baseRules. Re-applying optional() is a no-op.
export const updateShelterRules = baseRules.map((rule) => rule.optional());

export const occupancyRules = [
  body('current_occupancy')
    .exists({ values: 'null' })
    .withMessage('current_occupancy is required')
    .bail()
    .isInt({ min: 0 })
    .withMessage('current_occupancy must be a non-negative integer')
    .toInt(),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
