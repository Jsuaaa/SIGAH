// Tipos del módulo de bodegas. Reflejan server/src/types/entities.ts y la API
// /warehouses. La capacidad se mide en kg (RN-03, HU-11).

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE'

export const WAREHOUSE_STATUS_OPTIONS: { value: WarehouseStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activa' },
  { value: 'INACTIVE', label: 'Inactiva' },
]

export const WAREHOUSE_STATUS_LABELS = Object.fromEntries(
  WAREHOUSE_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<WarehouseStatus, string>

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
  created_at?: string
  updated_at?: string
}

// GET /warehouses y /warehouses/:id agregan indicadores de ocupación:
//  - is_over_85_percent: alerta al 85% (HU-11 CA3)
//  - occupancy_ratio: peso / capacidad (0..1, null si capacidad 0)
export interface WarehouseWithOccupancy extends Warehouse {
  is_over_85_percent: boolean
  occupancy_ratio: number | null
}

// GET /warehouses/nearest añade la distancia en km.
export interface WarehouseWithDistance extends WarehouseWithOccupancy {
  distance_km: number
}

export interface WarehouseListParams {
  page: number
  limit: number
  zone_id?: number
  status?: WarehouseStatus
  search?: string
}

// Cuerpo de POST/PUT /warehouses (lat/lng obligatorias, RN-10 / HU-11 CA2).
export interface WarehousePayload {
  name: string
  address: string
  zone_id: number
  max_capacity_kg: number
  status?: WarehouseStatus
  latitude: number
  longitude: number
}
