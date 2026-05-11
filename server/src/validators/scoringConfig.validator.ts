import { body } from 'express-validator';
import { SCORING_CONFIG_KEYS } from '../types/entities';

const KEY_VALUES = SCORING_CONFIG_KEYS as unknown as string[];

export const setScoringConfigRules = [
  body('key')
    .isIn(KEY_VALUES)
    .withMessage(`key must be one of: ${SCORING_CONFIG_KEYS.join(', ')}`),
  body('value')
    .isFloat()
    .withMessage('value must be a finite number')
    .toFloat(),
];
