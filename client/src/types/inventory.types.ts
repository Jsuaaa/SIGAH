// Inventario (HU-15). Espejo de la vista pública del backend:
//   - GET /inventory  → fn_inventory_list  → InventoryRowEnriched (paginada).
//   - GET /inventory/summary → fn_inventory_summary → InventorySummaryRow[].
// Las categorías de recurso se reutilizan de resourceType.types (no se redefinen).
import type { ResourceCategory } from './resourceType.types'

// Fila enriquecida de GET /inventory (server/src/types/entities.ts →
// InventoryRowEnriched; misma forma que fn_inventory_list). available_quantity es
// entero y total_weight_kg numérico; expiration_date es 'YYYY-MM-DD' o null.
// is_expired lo calcula el backend (expiration_date < CURRENT_DATE).
export interface InventoryRow {
  id: number
  warehouse_id: number
  warehouse_name: string
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

// Parámetros de GET /inventory (inventory.controller.list). El backend filtra por
// bodega, tipo de recurso, categoría y stock; NO hay búsqueda de texto. Paginación
// estándar page/limit.
export interface InventoryListParams {
  page: number
  limit: number
  warehouse_id?: number
  resource_type_id?: number
  category?: ResourceCategory
  only_in_stock?: boolean
}

// Fila de GET /inventory/summary (fn_inventory_summary): agregado por bodega +
// categoría. total_quantity es BIGINT y total_weight_kg NUMERIC; pg los serializa
// como string, por eso se tipan number | string y se normalizan con Number() en UI.
export interface InventorySummaryRow {
  warehouse_id: number
  warehouse_name: string
  category: ResourceCategory
  total_quantity: number | string
  total_weight_kg: number | string
}

// HU-17: ajuste de inventario con motivo. El enum de motivos es el del backend
// (adjustment_reason, server/src/types/entities.ts → 'MERMA'|'DANO'|'DEVOLUCION'|
// 'CORRECCION', en español por requisito del PDF). Las etiquetas son para la UI.
export type InventoryAdjustReason = 'MERMA' | 'DANO' | 'DEVOLUCION' | 'CORRECCION'

export const INVENTORY_ADJUST_REASON_OPTIONS: { value: InventoryAdjustReason; label: string }[] = [
  { value: 'MERMA', label: 'Merma' },
  { value: 'DANO', label: 'Daño' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'CORRECCION', label: 'Corrección' },
]

export const INVENTORY_ADJUST_REASON_LABELS: Record<InventoryAdjustReason, string> = {
  MERMA: 'Merma',
  DANO: 'Daño',
  DEVOLUCION: 'Devolución',
  CORRECCION: 'Corrección',
}

// Cuerpo real de PUT /inventory/:id/adjustment (adjustInventoryRules del backend):
// delta es un entero distinto de cero (positivo suma, negativo resta); reason y
// reason_note (3-500) son obligatorios. El backend rechaza stock negativo (SH422).
export interface InventoryAdjustPayload {
  delta: number
  reason: InventoryAdjustReason
  reason_note: string
}
