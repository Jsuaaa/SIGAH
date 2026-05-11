import { body } from 'express-validator';

export const setThresholdRules = [
  body('resource_type_id')
    .isInt({ min: 1 })
    .withMessage('resource_type_id must be a positive integer')
    .toInt(),
  body('min_quantity')
    .isInt({ min: 0 })
    .withMessage('min_quantity must be a non-negative integer')
    .toInt(),
];
