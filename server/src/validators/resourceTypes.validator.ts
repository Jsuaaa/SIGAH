import { body, param } from 'express-validator';
import { RESOURCE_CATEGORIES } from '../types/entities';

const CATEGORY_VALUES = RESOURCE_CATEGORIES as unknown as string[];

const baseRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),

  body('category')
    .isIn(CATEGORY_VALUES)
    .withMessage(`category must be one of: ${RESOURCE_CATEGORIES.join(', ')}`),

  body('unit_of_measure')
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('unit_of_measure must be between 1 and 30 characters'),

  body('unit_weight_kg')
    .isFloat({ min: 0 })
    .withMessage('unit_weight_kg must be >= 0')
    .toFloat(),
];

export const createResourceTypeRules = [...baseRules];

export const updateResourceTypeRules = [
  ...baseRules.map((rule) => rule.optional()),
  body('is_active').optional().isBoolean().toBoolean(),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
