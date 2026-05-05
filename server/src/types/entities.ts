// Hand-written interfaces that mirror the PostgreSQL schema. They replace the
// types Prisma used to generate. Keep them in sync with `db/migrations/*.sql`.

export type Role = 'ADMIN' | 'COORDINATOR' | 'OPERATOR' | 'VIEWER';

export const ROLES: readonly Role[] = ['ADMIN', 'COORDINATOR', 'OPERATOR', 'VIEWER'] as const;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
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
