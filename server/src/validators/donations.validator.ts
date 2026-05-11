import { body, param, query } from 'express-validator';
import { DONATION_TYPES } from '../types/entities';

const TYPE_VALUES = DONATION_TYPES as unknown as string[];

export const createDonationRules = [
  body('donor_id')
    .isInt({ min: 1 })
    .withMessage('donor_id must be a positive integer')
    .toInt(),

  body('donation_type')
    .isIn(TYPE_VALUES)
    .withMessage(`donation_type must be one of: ${DONATION_TYPES.join(', ')}`),

  // destination_warehouse_id required for IN_KIND/MIXED, must be absent for
  // pure MONETARY. We enforce it via custom validators that read sibling
  // fields rather than splitting into multiple chains.
  body('destination_warehouse_id')
    .custom((v: unknown, { req }) => {
      const type = (req.body as { donation_type?: string }).donation_type;
      if (type === 'IN_KIND' || type === 'MIXED') {
        if (!Number.isInteger(v) && !(typeof v === 'string' && /^\d+$/.test(v))) {
          throw new Error('destination_warehouse_id is required for IN_KIND/MIXED');
        }
        const num = Number(v);
        if (!(num >= 1)) throw new Error('destination_warehouse_id must be a positive integer');
      }
      return true;
    }),

  body('monetary_amount')
    .custom((v: unknown, { req }) => {
      const type = (req.body as { donation_type?: string }).donation_type;
      if (type === 'MONETARY' || type === 'MIXED') {
        const num = Number(v);
        if (!Number.isFinite(num) || num <= 0) {
          throw new Error('monetary_amount must be > 0 for MONETARY/MIXED');
        }
      }
      if (type === 'IN_KIND' && v !== undefined && v !== null) {
        throw new Error('monetary_amount must be omitted for IN_KIND');
      }
      return true;
    }),

  body('date').optional().isISO8601().withMessage('date must be ISO-8601'),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),

  body('details').optional().isArray().withMessage('details must be an array'),

  body('details.*.resource_type_id')
    .if(body('details').exists())
    .isInt({ min: 1 })
    .toInt(),
  body('details.*.quantity')
    .if(body('details').exists())
    .isInt({ gt: 0 })
    .toInt(),
  body('details.*.weight_kg')
    .if(body('details').exists())
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  body('details.*.batch')
    .if(body('details').exists())
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 60 }),
  body('details.*.expiration_date')
    .if(body('details').exists())
    .optional({ nullable: true })
    .isISO8601({ strict: true }),
];

export const listDonationRules = [
  query('donor_id').optional().isInt({ min: 1 }).toInt(),
  query('warehouse_id').optional().isInt({ min: 1 }).toInt(),
  query('type').optional().isIn(TYPE_VALUES),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
];

export const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];
