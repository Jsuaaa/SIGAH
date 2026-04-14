// Delivery constraints
export const MIN_COVERAGE_DAYS = 3;
export const KG_PER_PERSON_PER_DAY = 0.6;

// Prioritization
export const MAX_DAYS_WITHOUT_AID = 30;

export const ZONE_RISK_FACTORS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export const PRIORITY_WEIGHTS = {
  NUM_MEMBERS: 2,
  CHILDREN_UNDER_5: 5,
  ADULTS_OVER_65: 4,
  PREGNANT: 5,
  DISABLED: 4,
  ZONE_RISK: 3,
  DAYS_WITHOUT_AID: 1.5,
  DELIVERIES_RECEIVED: -2,
} as const;

// Authentication
export const JWT_EXPIRATION = '8h';

// Sequential code prefixes
export const CODE_PREFIXES = {
  FAMILY: 'FAM',
  DONATION: 'DON',
  DELIVERY: 'DEL',
} as const;

// Inventory alerts
export const WAREHOUSE_CAPACITY_ALERT_THRESHOLD = 0.9;
export const EXPIRATION_ALERT_DAYS = 7;

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
