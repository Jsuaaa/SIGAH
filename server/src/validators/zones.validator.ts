import { body, param } from 'express-validator';

const baseRules = [
  body('name')
    .isString()
    .withMessage('name must be a string')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),

  body('risk_level')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .withMessage('risk_level must be LOW, MEDIUM, HIGH or CRITICAL'),

  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),

  body('estimated_population')
    .isInt({ min: 0 })
    .withMessage('estimated_population must be a non-negative integer'),
];

export const createZoneRules = [...baseRules];

export const updateZoneRules = baseRules.map((rule) => rule.optional());

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
