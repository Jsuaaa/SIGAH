import { query } from 'express-validator';

// Resource categories from the DB enum (must match resource_category).
const RESOURCE_CATEGORIES = ['FOOD', 'BLANKET', 'MATTRESS', 'HYGIENE', 'MEDICATION'];

// Export formats supported by advanced report endpoints (Issue #31).
const EXPORT_FORMATS = ['json', 'pdf', 'xlsx'];

/**
 * Validation rules for GET /reports/inventory
 * RF-28 CA2 — filtros opcionales por bodega y categoría.
 */
export const inventoryRules = [
  query('warehouse_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('warehouse_id must be a positive integer')
    .toInt(),
  query('category')
    .optional()
    .isIn(RESOURCE_CATEGORIES)
    .withMessage(`category must be one of: ${RESOURCE_CATEGORIES.join(', ')}`),
];

/**
 * Validation rules for GET /reports/unattended-families
 * RF-28 CA3 — filtros opcionales de zona y fecha.
 */
export const unattendedFamiliesRules = [
  query('zone_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('zone_id must be a positive integer')
    .toInt(),
  query('since')
    .optional()
    .isDate({ format: 'YYYY-MM-DD' })
    .withMessage('since must be a valid date in YYYY-MM-DD format'),
];

// ── Issue #31 — Advanced Reports Validators ───────────────────────────────────

/**
 * Validation rules for GET /reports/donations-by-type
 * Issue #31 CA1 — Donaciones agrupadas por tipo de donante.
 * Justificación: HU-29 CA1.
 */
export const donationsByTypeRules = [
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid date (YYYY-MM-DD)'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid date (YYYY-MM-DD)'),
  query('format')
    .optional()
    .isIn(EXPORT_FORMATS)
    .withMessage(`format must be one of: ${EXPORT_FORMATS.join(', ')}`),
];

/**
 * Validation rules for GET /reports/deliveries-by-zone
 * Issue #31 CA2 — Entregas por zona.
 * Justificación: HU-29 CA2.
 */
export const deliveriesByZoneRules = [
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid date (YYYY-MM-DD)'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid date (YYYY-MM-DD)'),
  query('format')
    .optional()
    .isIn(EXPORT_FORMATS)
    .withMessage(`format must be one of: ${EXPORT_FORMATS.join(', ')}`),
];

/**
 * Validation rules for GET /reports/dashboard
 * Issue #31 CA3 — Dashboard de métricas (1 sola query JSONB).
 * Justificación: HU-28, HU-29 CA3.
 */
export const dashboardRules = [
  query('format')
    .optional()
    .isIn(EXPORT_FORMATS)
    .withMessage(`format must be one of: ${EXPORT_FORMATS.join(', ')}`),
];

/**
 * Validation rules for GET /reports/traceability
 * Issue #31 CA5/CA6 — Trazabilidad donante → bodega → entrega → familia.
 * Justificación: HU-29 CA1, CA3.
 * Requiere donation_id O resource_type_id (validación cross-field en controller).
 */
export const traceabilityRules = [
  query('donation_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('donation_id must be a positive integer')
    .toInt(),
  query('resource_type_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('resource_type_id must be a positive integer')
    .toInt(),
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid date (YYYY-MM-DD)'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid date (YYYY-MM-DD)'),
  query('format')
    .optional()
    .isIn(EXPORT_FORMATS)
    .withMessage(`format must be one of: ${EXPORT_FORMATS.join(', ')}`),
];
