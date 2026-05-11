import { body, param } from 'express-validator';
import { DONOR_TYPES } from '../types/entities';

const TYPE_VALUES = DONOR_TYPES as unknown as string[];

const baseRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('name must be between 2 and 200 characters'),

  body('type')
    .isIn(TYPE_VALUES)
    .withMessage(`type must be one of: ${DONOR_TYPES.join(', ')}`),

  // HU-18 CA2 — contact is required and non-empty.
  body('contact')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('contact is required (HU-18 CA2)'),

  body('tax_id')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 30 }),
];

export const createDonorRules = [...baseRules];

export const updateDonorRules = [
  ...baseRules.map((rule) => rule.optional()),
  body('is_active').optional().isBoolean().toBoolean(),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
