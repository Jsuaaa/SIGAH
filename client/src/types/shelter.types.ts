export type ShelterType = 'SCHOOL' | 'CHURCH' | 'COMMUNITY_CENTER' | 'STADIUM' | 'TENT' | 'OTHER'

export const SHELTER_TYPE_OPTIONS: { value: ShelterType; label: string }[] = [
  { value: 'SCHOOL', label: 'Escuela' },
  { value: 'CHURCH', label: 'Iglesia' },
  { value: 'COMMUNITY_CENTER', label: 'Centro comunitario' },
  { value: 'STADIUM', label: 'Estadio' },
  { value: 'TENT', label: 'Carpa' },
  { value: 'OTHER', label: 'Otro' },
]

export const SHELTER_TYPE_LABELS = Object.fromEntries(
  SHELTER_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ShelterType, string>

export interface Shelter {
  id: number
  name: string
  address: string
  zone_id: number
  max_capacity: number
  current_occupancy: number
  type: ShelterType
  latitude: number
  longitude: number
  created_at?: string
  updated_at?: string
}

// GET /shelters y /shelters/:id agregan ocupación derivada:
//  - is_over_capacity: ocupación / capacidad > 0.9 (HU-10 CA3)
//  - occupancy_ratio: razón redondeada (null si max_capacity = 0)
export interface ShelterWithOccupancy extends Shelter {
  is_over_capacity: boolean
  occupancy_ratio: number | null
}

export interface ShelterListParams {
  page: number
  limit: number
  zone_id?: number
  type?: ShelterType
  search?: string
}

// Cuerpo de POST/PUT /shelters (lat/lng obligatorias, RN-10).
export interface ShelterPayload {
  name: string
  address: string
  zone_id: number
  max_capacity: number
  current_occupancy?: number
  type: ShelterType
  latitude: number
  longitude: number
}
