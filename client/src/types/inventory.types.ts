// Tipos del dominio de inventario: catálogo de recursos, existencias, resumen,
// alertas, umbrales y ajustes. Reflejan server/src/types/entities.ts.

// --- Categorías de recurso ----------------------------------------------------
export type ResourceCategory = 'FOOD' | 'BLANKET' | 'MATTRESS' | 'HYGIENE' | 'MEDICATION'

export const RESOURCE_CATEGORY_OPTIONS: { value: ResourceCategory; label: string }[] = [
  { value: 'FOOD', label: 'Alimentos' },
  { value: 'BLANKET', label: 'Cobijas' },
  { value: 'MATTRESS', label: 'Colchonetas' },
  { value: 'HYGIENE', label: 'Higiene' },
  { value: 'MEDICATION', label: 'Medicamentos' },
]

export const RESOURCE_CATEGORY_LABELS = Object.fromEntries(
  RESOURCE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ResourceCategory, string>

// --- Tipo de recurso (catálogo) -----------------------------------------------
export interface ResourceType {
  id: number
  name: string
  category: ResourceCategory
  unit_of_measure: string
  unit_weight_kg: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface ResourceTypeListParams {
  category?: ResourceCategory
  is_active?: boolean
}

export interface ResourceTypePayload {
  name: string
  category: ResourceCategory
  unit_of_measure: string
  unit_weight_kg: number
}

// --- Existencias --------------------------------------------------------------
// Fila enriquecida que devuelven GET /inventory y /warehouses/:id/inventory.
export interface InventoryRow {
  id: number
  warehouse_id: number
  resource_type_id: number
  available_quantity: number
  total_weight_kg: number
  batch: string | null
  expiration_date: string | null
  is_expired: boolean
  resource: {
    id: number
    name: string
    category: ResourceCategory
    unit_of_measure: string
    unit_weight_kg: number
    is_active: boolean
  }
  created_at?: string
  updated_at?: string
}

export interface InventoryListParams {
  page: number
  limit: number
  warehouse_id?: number
  resource_type_id?: number
  category?: ResourceCategory
  only_in_stock?: boolean
}

// total_quantity llega como string (BIGINT de pg).
export interface InventorySummaryRow {
  warehouse_id: number
  warehouse_name: string
  category: ResourceCategory | null
  total_quantity: string
  total_weight_kg: number
}

// --- Alertas ------------------------------------------------------------------
export type AlertKind = 'LOW_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | 'WAREHOUSE_OVER_85'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  LOW_STOCK: 'Stock bajo',
  EXPIRING_SOON: 'Próximo a vencer',
  EXPIRED: 'Vencido',
  WAREHOUSE_OVER_85: 'Bodega sobre 85%',
}

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
}

export interface InventoryAlert {
  kind: AlertKind
  severity: AlertSeverity
  message: string
  link: string
  metadata: Record<string, unknown>
}

// --- Umbrales -----------------------------------------------------------------
export interface AlertThreshold {
  id: number
  resource_type_id: number
  min_quantity: number
  updated_by: number | null
  updated_at: string
  resource?: {
    id: number
    name: string
    category: ResourceCategory
    unit_of_measure: string
    unit_weight_kg: number
    is_active: boolean
  }
}

export interface SetThresholdPayload {
  resource_type_id: number
  min_quantity: number
}

// --- Ajustes ------------------------------------------------------------------
export type AdjustmentReason = 'MERMA' | 'DANO' | 'DEVOLUCION' | 'CORRECCION'

export const ADJUSTMENT_REASON_OPTIONS: { value: AdjustmentReason; label: string }[] = [
  { value: 'MERMA', label: 'Merma' },
  { value: 'DANO', label: 'Daño' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'CORRECCION', label: 'Corrección de error' },
]

export interface UpsertInventoryPayload {
  warehouse_id: number
  resource_type_id: number
  quantity: number
  batch?: string | null
  expiration_date?: string | null
}

export interface AdjustInventoryPayload {
  delta: number
  reason: AdjustmentReason
  reason_note: string
}
