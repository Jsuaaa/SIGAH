// Tipos de traslados de familias entre refugios (HU-24).
import type { FamilyStatus } from './family.types'

export type RelocationType = 'TEMPORARY' | 'PERMANENT'

export const RELOCATION_TYPE_OPTIONS: { value: RelocationType; label: string }[] = [
  { value: 'TEMPORARY', label: 'Temporal' },
  { value: 'PERMANENT', label: 'Permanente' },
]
export const RELOCATION_TYPE_LABELS = Object.fromEntries(
  RELOCATION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<RelocationType, string>

interface ShelterRef {
  id: number
  name: string
  address: string
  max_capacity: number
  current_occupancy: number
}

export interface RelocationEnriched {
  id: number
  family_id: number
  origin_shelter_id: number | null
  destination_shelter_id: number
  type: RelocationType
  relocation_date: string
  reason: string
  authorized_by: number
  notes: string | null
  created_at: string
  family?: {
    id: number
    family_code: string
    head_document: string
    num_members: number
    status: FamilyStatus
    zone_id: number
  }
  origin_shelter?: ShelterRef | null
  destination_shelter?: ShelterRef
  authorized_by_user?: { id: number; name: string; role: string }
}

export interface RelocationListParams {
  page: number
  limit: number
  family_id?: number
  type?: RelocationType
  date_from?: string
  date_to?: string
}

export interface RelocationPayload {
  family_id: number
  destination_shelter_id: number
  type: RelocationType
  reason: string
  notes?: string | null
}
