export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const RISK_LEVEL_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: 'LOW', label: 'Bajo' },
  { value: 'MEDIUM', label: 'Medio' },
  { value: 'HIGH', label: 'Alto' },
  { value: 'CRITICAL', label: 'Crítico' },
]

export interface Zone {
  id: number
  name: string
  risk_level: RiskLevel
  latitude: number
  longitude: number
  estimated_population: number
  created_at?: string
  updated_at?: string
}

export interface ZoneListParams {
  page: number
  limit: number
  risk_level?: RiskLevel
  search?: string
}

// Cuerpo de POST/PUT /zones (lat/lng obligatorias, RN-10).
export interface ZonePayload {
  name: string
  risk_level: RiskLevel
  latitude: number
  longitude: number
  estimated_population: number
}

// Bodega como la devuelve GET /zones/:id/warehouses. El módulo de bodegas aún
// no tiene UI; este tipo mínimo cubre el tab del detalle de zona.
export interface ZoneWarehouse {
  id: number
  name: string
  address: string
  max_capacity_kg: number
  current_weight_kg: number
  is_over_85_percent?: boolean
  occupancy_ratio?: number | null
}
