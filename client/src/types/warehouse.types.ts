export type WarehouseStatus = 'ACTIVE' | 'INACTIVE'

export const WAREHOUSE_STATUS_OPTIONS: { value: WarehouseStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activa' },
  { value: 'INACTIVE', label: 'Inactiva' },
]

export const WAREHOUSE_STATUS_LABELS = Object.fromEntries(
  WAREHOUSE_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<WarehouseStatus, string>

// Categorías de recurso (enum del backend, server/src/types/entities.ts).
export type ResourceCategory = 'FOOD' | 'BLANKET' | 'MATTRESS' | 'HYGIENE' | 'MEDICATION'

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  FOOD: 'Alimentos',
  BLANKET: 'Cobijas',
  MATTRESS: 'Colchonetas',
  HYGIENE: 'Higiene',
  MEDICATION: 'Medicamentos',
}

// Bodega tal como la devuelve GET /warehouses y GET /warehouses/:id. El backend
// (fn_warehouses_list / fn_warehouses_find_by_id) agrega dos campos derivados de
// capacidad sobre las columnas de la tabla:
//   - is_over_85_percent: current/max > 0.85 (HU-11 CA3, alerta de capacidad, RN-03).
//   - occupancy_ratio:    current/max redondeado a 4 decimales (null si max = 0).
// El bloqueo de ingreso al 100% (HU-11 CA2) corresponde a occupancy_ratio >= 1.
export interface Warehouse {
  id: number
  name: string
  address: string
  zone_id: number
  max_capacity_kg: number
  current_weight_kg: number
  status: WarehouseStatus
  latitude: number
  longitude: number
  is_over_85_percent: boolean
  occupancy_ratio: number | null
  created_at?: string
  updated_at?: string
}

export interface WarehouseListParams {
  page: number
  limit: number
  zone_id?: number
  status?: WarehouseStatus
  search?: string
}

// Cuerpo de POST/PUT /warehouses (lat/lng obligatorias, RN-10). current_weight_kg
// es opcional en el validador, pero el peso real lo gestiona el inventario (HU-17);
// el formulario no lo expone.
export interface WarehousePayload {
  name: string
  address: string
  zone_id: number
  max_capacity_kg: number
  status?: WarehouseStatus
  current_weight_kg?: number
  latitude: number
  longitude: number
}

// Fila de inventario que devuelve GET /warehouses/:id/inventory (solo lectura
// aquí; el ajuste es HU-17). Ver fn_warehouses_inventory.sql / InventoryRowEnriched.
export interface WarehouseInventoryRow {
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
