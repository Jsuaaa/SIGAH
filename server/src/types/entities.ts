// Hand-written interfaces that mirror the PostgreSQL schema. They replace the
// types Prisma used to generate. Keep them in sync with `db/migrations/*.sql`.

export type Role =
  | 'ADMIN'
  | 'CENSADOR'
  | 'OPERADOR_ENTREGAS'
  | 'COORDINADOR_LOGISTICA'
  | 'FUNCIONARIO_CONTROL'
  | 'REGISTRADOR_DONACIONES';

export const ROLES: readonly Role[] = [
  'ADMIN',
  'CENSADOR',
  'OPERADOR_ENTREGAS',
  'COORDINADOR_LOGISTICA',
  'FUNCIONARIO_CONTROL',
  'REGISTRADOR_DONACIONES',
] as const;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  name: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  password_must_change: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Zone {
  id: number;
  name: string;
  risk_level: RiskLevel;
  latitude: number;
  longitude: number;
  estimated_population: number;
  created_at: Date;
  updated_at: Date;
}

export type ShelterType =
  | 'SCHOOL'
  | 'CHURCH'
  | 'COMMUNITY_CENTER'
  | 'STADIUM'
  | 'TENT'
  | 'OTHER';

export const SHELTER_TYPES: readonly ShelterType[] = [
  'SCHOOL',
  'CHURCH',
  'COMMUNITY_CENTER',
  'STADIUM',
  'TENT',
  'OTHER',
] as const;

export interface Shelter {
  id: number;
  name: string;
  address: string;
  zone_id: number;
  max_capacity: number;
  current_occupancy: number;
  type: ShelterType;
  latitude: number;
  longitude: number;
  created_at: Date;
  updated_at: Date;
}

// Returned by fn_shelters_list / fn_shelters_find_by_id with the derived
// occupancy fields appended via jsonb_build_object.
export interface ShelterWithOccupancy extends Shelter {
  is_over_capacity: boolean;
  occupancy_ratio: number | null;
}

export type FamilyStatus = 'ACTIVO' | 'EN_REFUGIO' | 'EVACUADO';

export const FAMILY_STATUSES: readonly FamilyStatus[] = [
  'ACTIVO',
  'EN_REFUGIO',
  'EVACUADO',
] as const;

export interface Family {
  id: number;
  family_code: string;
  head_document: string;
  zone_id: number;
  shelter_id: number | null;
  num_members: number;
  num_children_under_5: number;
  num_adults_over_65: number;
  num_pregnant: number;
  num_disabled: number;
  priority_score: number;
  priority_score_breakdown: Record<string, unknown>;
  status: FamilyStatus;
  latitude: number | null;
  longitude: number | null;
  reference_address: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PrivacyConsent {
  id: number;
  family_id: number;
  accepted_at: Date;
  accepted_by_user_id: number;
  law_version: string;
  ip_address: string | null;
}

export type Relationship =
  | 'ESPOSO_A'
  | 'HIJO_A'
  | 'PADRE_MADRE'
  | 'HERMANO_A'
  | 'OTRO';

export const RELATIONSHIPS: readonly Relationship[] = [
  'ESPOSO_A',
  'HIJO_A',
  'PADRE_MADRE',
  'HERMANO_A',
  'OTRO',
] as const;

export type Gender = 'M' | 'F' | 'OTRO';

export const GENDERS: readonly Gender[] = ['M', 'F', 'OTRO'] as const;

export type SpecialCondition =
  | 'CHILD_UNDER_5'
  | 'ELDERLY_OVER_65'
  | 'PREGNANT'
  | 'DISABLED';

export const SPECIAL_CONDITIONS: readonly SpecialCondition[] = [
  'CHILD_UNDER_5',
  'ELDERLY_OVER_65',
  'PREGNANT',
  'DISABLED',
] as const;

export interface Person {
  id: number;
  family_id: number;
  name: string;
  document: string;
  birth_date: string; // pg DATE comes through as 'YYYY-MM-DD'
  gender: Gender;
  relationship: Relationship;
  special_conditions: SpecialCondition[];
  requires_medication: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PersonWithFamily {
  person: Person;
  family: Family;
}

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';

export const WAREHOUSE_STATUSES: readonly WarehouseStatus[] = [
  'ACTIVE',
  'INACTIVE',
] as const;

export interface Warehouse {
  id: number;
  name: string;
  address: string;
  zone_id: number;
  max_capacity_kg: number;
  current_weight_kg: number;
  status: WarehouseStatus;
  latitude: number;
  longitude: number;
  created_at: Date;
  updated_at: Date;
}

export interface WarehouseWithOccupancy extends Warehouse {
  is_over_85_percent: boolean;
  occupancy_ratio: number | null;
}

export interface WarehouseWithDistance extends WarehouseWithOccupancy {
  distance_km: number;
}

export type ResourceCategory =
  | 'FOOD'
  | 'BLANKET'
  | 'MATTRESS'
  | 'HYGIENE'
  | 'MEDICATION';

export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  'FOOD',
  'BLANKET',
  'MATTRESS',
  'HYGIENE',
  'MEDICATION',
] as const;

export type AdjustmentReason = 'MERMA' | 'DANO' | 'DEVOLUCION' | 'CORRECCION';

export const ADJUSTMENT_REASONS: readonly AdjustmentReason[] = [
  'MERMA',
  'DANO',
  'DEVOLUCION',
  'CORRECCION',
] as const;

export interface ResourceType {
  id: number;
  name: string;
  category: ResourceCategory;
  unit_of_measure: string;
  unit_weight_kg: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryRow {
  id: number;
  warehouse_id: number;
  resource_type_id: number;
  available_quantity: number;
  total_weight_kg: number;
  batch: string;
  expiration_date: string | null;
  created_at: Date;
  updated_at: Date;
}

// Returned by fn_inventory_list / fn_warehouses_inventory enriched with the
// joined resource_types snapshot.
export interface InventoryRowEnriched extends InventoryRow {
  is_expired: boolean;
  resource: {
    id: number;
    name: string;
    category: ResourceCategory;
    unit_of_measure: string;
    unit_weight_kg: number;
    is_active: boolean;
  };
}

export interface InventorySummaryRow {
  warehouse_id: number;
  warehouse_name: string;
  category: ResourceCategory | null;
  total_quantity: string; // BIGINT
  total_weight_kg: number;
}

export interface InventoryAdjustment {
  id: number;
  inventory_id: number;
  delta: number;
  reason: AdjustmentReason;
  reason_note: string;
  user_id: number;
  created_at: Date;
}

export interface AlertThreshold {
  id: number;
  resource_type_id: number;
  min_quantity: number;
  updated_by: number | null;
  updated_at: Date;
}

export interface AlertThresholdEnriched extends AlertThreshold {
  resource: {
    id: number;
    name: string;
    category: ResourceCategory;
    unit_of_measure: string;
    unit_weight_kg: number;
    is_active: boolean;
  };
}

export type AlertKind =
  | 'LOW_STOCK'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'WAREHOUSE_OVER_85';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface InventoryAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  link: string;
  metadata: Record<string, unknown>;
}

export type DonorType =
  | 'PERSONA_NATURAL'
  | 'EMPRESA'
  | 'ALCALDIA'
  | 'GOBERNACION'
  | 'ORGANIZACION';

export const DONOR_TYPES: readonly DonorType[] = [
  'PERSONA_NATURAL',
  'EMPRESA',
  'ALCALDIA',
  'GOBERNACION',
  'ORGANIZACION',
] as const;

export interface Donor {
  id: number;
  name: string;
  type: DonorType;
  contact: string;
  tax_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type DonationType = 'IN_KIND' | 'MONETARY' | 'MIXED';

export const DONATION_TYPES: readonly DonationType[] = ['IN_KIND', 'MONETARY', 'MIXED'] as const;

export interface DonationDetailInput {
  resource_type_id: number;
  quantity: number;
  weight_kg?: number;
  batch?: string | null;
  expiration_date?: string | null;
}

export interface DonationDetail {
  id: number;
  resource_type_id: number;
  resource_name: string;
  category: ResourceCategory;
  quantity: number;
  weight_kg: number;
  batch: string | null;
  expiration_date: string | null;
}

export interface Donation {
  id: number;
  donation_code: string;
  donor_id: number;
  destination_warehouse_id: number | null;
  donation_type: DonationType;
  monetary_amount: string | null; // pg NUMERIC → string
  date: Date;
  notes: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonationEnriched extends Donation {
  donor?: Donor;
  details: DonationDetail[];
}

// Scoring config rows are flat (key, value). The seed in migration 008
// guarantees these keys exist; the API only edits their values.
export type ScoringConfigKey =
  | 'W_MEMBERS'
  | 'W_CHILDREN_5'
  | 'W_ADULTS_65'
  | 'W_PREGNANT'
  | 'W_DISABLED'
  | 'W_ZONE_RISK'
  | 'W_DAYS_NO_AID'
  | 'W_DELIVERIES'
  | 'MAX_DAYS';

export const SCORING_CONFIG_KEYS: readonly ScoringConfigKey[] = [
  'W_MEMBERS',
  'W_CHILDREN_5',
  'W_ADULTS_65',
  'W_PREGNANT',
  'W_DISABLED',
  'W_ZONE_RISK',
  'W_DAYS_NO_AID',
  'W_DELIVERIES',
  'MAX_DAYS',
] as const;

export interface ScoringConfigRow {
  key: ScoringConfigKey;
  value: number;
  updated_by: number | null;
  updated_at: Date;
}

export interface RankingRow {
  id: number;
  family_code: string;
  head_document: string;
  zone_id: number;
  zone_name: string;
  shelter_id: number | null;
  num_members: number;
  num_children_under_5: number;
  num_adults_over_65: number;
  num_pregnant: number;
  num_disabled: number;
  priority_score: number;
  priority_score_breakdown: Record<string, unknown>;
  status: FamilyStatus;
  last_delivery_date: string | null;
}

export interface NextBatchEligibility {
  is_eligible: boolean;
  reason: string;
  next_eligible_at: string | null;
}

export interface NextBatchRow {
  id: number;
  family_code: string;
  head_document: string;
  zone_id: number;
  zone_name: string;
  shelter_id: number | null;
  num_members: number;
  priority_score: number;
  priority_score_breakdown: Record<string, unknown>;
  status: FamilyStatus;
  last_delivery_date: string | null;
  eligibility: NextBatchEligibility;
}

export type DeliveryStatus = 'PROGRAMADA' | 'EN_CURSO' | 'ENTREGADA';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PROGRAMADA',
  'EN_CURSO',
  'ENTREGADA',
] as const;

export interface Delivery {
  id: number;
  delivery_code: string;
  family_id: number;
  source_warehouse_id: number;
  plan_item_id: number | null;
  delivery_date: Date;
  delivered_by: number | null;
  received_by_document: string | null;
  coverage_days: number;
  status: DeliveryStatus;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  exception_reason: string | null;
  exception_authorized_by: number | null;
  client_op_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryDetail {
  id: number;
  resource_type_id: number;
  resource_name: string;
  category: ResourceCategory;
  quantity: number;
  weight_kg: number;
  batch: string | null;
}

export interface DeliveryEnriched extends Delivery {
  family?: Family;
  warehouse?: Warehouse;
  details: DeliveryDetail[];
}

export interface DeliveryEligibility {
  is_eligible: boolean;
  reason: string;
  last_delivery_at: string | null;
  coverage_expires: string | null;
  days_remaining: number | null;
  next_eligible_at: string | null;
}

export interface DeliveryDetailInput {
  resource_type_id: number;
  quantity: number;
  batch?: string | null;
}

// ---------------------------------------------------------------------------
// Distribution Plans (Issue #46, HU-21)
// ---------------------------------------------------------------------------

export type DistributionPlanStatus =
  | 'PROGRAMADA'
  | 'EN_EJECUCION'
  | 'COMPLETADA'
  | 'CANCELADA';

export const DISTRIBUTION_PLAN_STATUSES: readonly DistributionPlanStatus[] = [
  'PROGRAMADA',
  'EN_EJECUCION',
  'COMPLETADA',
  'CANCELADA',
] as const;

export type DistributionPlanScope = 'GLOBAL' | 'ZONA' | 'REFUGIO' | 'LOTE';

export const DISTRIBUTION_PLAN_SCOPES: readonly DistributionPlanScope[] = [
  'GLOBAL',
  'ZONA',
  'REFUGIO',
  'LOTE',
] as const;

export type DistributionPlanItemStatus = 'PENDIENTE' | 'ENTREGADO' | 'SIN_ATENDER';

export const DISTRIBUTION_PLAN_ITEM_STATUSES: readonly DistributionPlanItemStatus[] = [
  'PENDIENTE',
  'ENTREGADO',
  'SIN_ATENDER',
] as const;

export interface DistributionPlan {
  id: number;
  plan_code: string;
  created_by: number;
  status: DistributionPlanStatus;
  scope: DistributionPlanScope;
  scope_id: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DistributionPlanItem {
  id: number;
  plan_id: number;
  family_id: number;
  source_warehouse_id: number | null;
  target_coverage_days: number;
  priority_score_snapshot: number;
  status: DistributionPlanItemStatus;
  delivery_id: number | null;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DistributionPlanWithItems extends DistributionPlan {
  items: DistributionPlanItem[];
  // Counters included by fn_distribution_plans_list
  items_total?: number;
  items_pendientes?: number;
  items_entregados?: number;
  items_sin_atender?: number;
}

// ---------------------------------------------------------------------------
// Relocations (Issue #27, HU-24, RF-15)
// ---------------------------------------------------------------------------

export type RelocationType = 'TEMPORARY' | 'PERMANENT';

export const RELOCATION_TYPES: readonly RelocationType[] = [
  'TEMPORARY',
  'PERMANENT',
] as const;

export interface Relocation {
  id: number;
  family_id: number;
  origin_shelter_id: number | null;
  destination_shelter_id: number;
  type: RelocationType;
  relocation_date: Date;
  reason: string;
  authorized_by: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RelocationEnriched extends Relocation {
  family?: {
    id: number;
    family_code: string;
    head_document: string;
    num_members: number;
    status: FamilyStatus;
    zone_id: number;
  };
  origin_shelter?: {
    id: number;
    name: string;
    address: string;
    max_capacity: number;
    current_occupancy: number;
  } | null;
  destination_shelter?: {
    id: number;
    name: string;
    address: string;
    max_capacity: number;
    current_occupancy: number;
  };
  authorized_by_user?: {
    id: number;
    name: string;
    role: Role;
  };
}

// ---------------------------------------------------------------------------
// Health Vectors (Issue #25 / #26, HU-25)
// ---------------------------------------------------------------------------

export type VectorType =
  | 'AGUA_CONTAMINADA'
  | 'INSECTOS'
  | 'ROEDORES'
  | 'OTRO';

export const VECTOR_TYPES: readonly VectorType[] = [
  'AGUA_CONTAMINADA',
  'INSECTOS',
  'ROEDORES',
  'OTRO',
] as const;

export type HealthVectorStatus = 'ACTIVO' | 'EN_ATENCION' | 'RESUELTO';

export const HEALTH_VECTOR_STATUSES: readonly HealthVectorStatus[] = [
  'ACTIVO',
  'EN_ATENCION',
  'RESUELTO',
] as const;

export interface HealthVector {
  id: number;
  vector_type: VectorType;
  risk_level: RiskLevel;
  status: HealthVectorStatus;
  description: string | null;
  actions_taken: string | null;
  latitude: number | null;
  longitude: number | null;
  zone_id: number | null;
  shelter_id: number | null;
  reported_date: Date;
  reported_by: number;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface HealthVectorEnriched extends HealthVector {
  zone: Zone | null;
  shelter: Shelter | null;
}

// ---------------------------------------------------------------------------
// AuditLog (Issue #47, HU-31, RNF-09)
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: number;
  action: string;
  module: string;
  entity: string;
  entity_id: number | null;
  user_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}
