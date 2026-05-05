import { body, param, query } from 'express-validator';
import { GENDERS, RELATIONSHIPS, SPECIAL_CONDITIONS } from '../types/entities';

const GENDER_VALUES = GENDERS as unknown as string[];
const RELATIONSHIP_VALUES = RELATIONSHIPS as unknown as string[];
const SPECIAL_CONDITION_VALUES = SPECIAL_CONDITIONS as unknown as string[];

const baseRules = [
  body('family_id')
    .isInt({ min: 1 })
    .withMessage('family_id must be a positive integer')
    .toInt(),

  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),

  body('document')
    .isString()
    .trim()
    .isLength({ min: 5, max: 30 })
    .withMessage('document must be between 5 and 30 characters'),

  body('birth_date')
    .isISO8601({ strict: true })
    .withMessage('birth_date must be ISO-8601 (YYYY-MM-DD)')
    .bail()
    .custom((value: string) => {
      if (new Date(value) > new Date()) {
        throw new Error('birth_date cannot be in the future');
      }
      return true;
    }),

  body('gender')
    .isIn(GENDER_VALUES)
    .withMessage(`gender must be one of: ${GENDERS.join(', ')}`),

  body('relationship')
    .isIn(RELATIONSHIP_VALUES)
    .withMessage(`relationship must be one of: ${RELATIONSHIPS.join(', ')}`),

  body('special_conditions')
    .optional()
    .isArray()
    .withMessage('special_conditions must be an array')
    .bail()
    .custom((arr: unknown[]) => {
      if (!arr.every((v) => typeof v === 'string' && SPECIAL_CONDITION_VALUES.includes(v))) {
        throw new Error(
          `special_conditions values must be in: ${SPECIAL_CONDITIONS.join(', ')}`,
        );
      }
      return true;
    }),

  body('requires_medication')
    .optional()
    .isBoolean()
    .withMessage('requires_medication must be a boolean')
    .toBoolean(),
];

export const createPersonRules = [...baseRules];

export const updatePersonRules = baseRules.map((rule) => rule.optional());

export const searchByDocumentRules = [
  query('document')
    .isString()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('document must be between 3 and 30 characters'),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

export const familyIdParamRule = [
  param('id').isInt({ min: 1 }).withMessage('family id must be a positive integer').toInt(),
];
