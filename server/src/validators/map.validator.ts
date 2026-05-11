// Validators for map endpoints.
// Only shape validation here — business logic lives in SPs.

import { param, query } from 'express-validator';

/**
 * Validates :id param as a positive integer.
 * Used by GET /map/zone/:id.
 */
export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

/**
 * Validates optional ?days query param as a positive integer (1–365).
 * Used by GET /map/recent-deliveries and GET /map/zones-without-deliveries.
 */
export const daysQueryRule = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('days must be a positive integer between 1 and 365')
    .toInt(),
];
