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
export const FAILED_LOGIN_LIMIT = 5;        // AC #9.1 — bloqueo tras 5 fallos (HU-03)
export const ACCOUNT_LOCK_MINUTES = 15;     // AC #9.1 — bloqueo de 15 min (HU-03)
export const MIN_PASSWORD_LENGTH = 8;       // AC #9.1 — mínimo 8 chars (HU-03 CA3)

// Sequential code prefixes
export const CODE_PREFIXES = {
  FAMILY: 'FAM',
  DONATION: 'DON',
  DELIVERY: 'ENT',   // AC #9.1 — RN-07 usa prefijo ENT
} as const;

// Inventory alerts
export const WAREHOUSE_CAPACITY_ALERT_THRESHOLD = 0.85; // AC #9.1 — HU-11 CA3
export const EXPIRATION_ALERT_DAYS = 7;

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
