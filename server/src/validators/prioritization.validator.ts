import { query } from 'express-validator';
import { FAMILY_STATUSES } from '../types/entities';

const STATUS_VALUES = FAMILY_STATUSES as unknown as string[];

export const rankingRules = [
  query('zone_id').optional().isInt({ min: 1 }).toInt(),
  query('status').optional().isIn(STATUS_VALUES),
];

export const nextBatchRules = [
  query('count').optional().isInt({ min: 1, max: 1000 }).toInt(),
];
