/**
 * sync.validator.ts
 *
 * Validation rules for the /sync endpoints.
 * References: Issue #32 / GH #48 — offline batch sync.
 */

import { body } from 'express-validator';

const SUPPORTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const processBatchRules = [
  body('ops')
    .isArray({ min: 1, max: 200 })
    .withMessage('ops must be a non-empty array with at most 200 items'),

  body('ops.*.client_op_id')
    .isString()
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage('Each op must have a client_op_id string (8–128 chars)'),

  body('ops.*.method')
    .isIn(SUPPORTED_METHODS)
    .withMessage(`Each op.method must be one of ${SUPPORTED_METHODS.join(', ')}`),

  body('ops.*.url')
    .isString()
    .trim()
    .isLength({ min: 1, max: 512 })
    .withMessage('Each op.url must be a non-empty string (max 512 chars)'),

  body('ops.*.payload')
    .optional({ nullable: true })
    .isObject()
    .withMessage('op.payload must be a JSON object when provided'),
];
