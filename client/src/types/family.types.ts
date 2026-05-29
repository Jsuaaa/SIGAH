export type FamilyStatus = 'ACTIVO' | 'EN_REFUGIO' | 'EVACUADO'

export const FAMILY_STATUS_OPTIONS: { value: FamilyStatus; label: string }[] = [
  { value: 'ACTIVO', label: 'Activa' },
  { value: 'EN_REFUGIO', label: 'En refugio' },
  { value: 'EVACUADO', label: 'Evacuada' },
]

export type FamilyOrderBy = 'priority_score_desc' | 'created_at_desc' | 'family_code_asc'

export interface Family {
  id: number
  family_code: string
  head_document: string
  zone_id: number
  shelter_id: number | null
  num_members: number
  num_children_under_5: number
  num_adults_over_65: number
  num_pregnant: number
  num_disabled: number
  priority_score: number
  priority_score_breakdown: Record<string, unknown>
  status: FamilyStatus
  latitude: number | null
  longitude: number | null
  reference_address: string | null
  created_at: string
  updated_at: string
}

export interface FamilyListParams {
  page: number
  limit: number
  q?: string
  zone_id?: number
  shelter_id?: number
  status?: FamilyStatus
  order_by?: FamilyOrderBy
}
