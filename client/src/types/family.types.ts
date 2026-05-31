export type FamilyStatus = 'ACTIVO' | 'EN_REFUGIO' | 'EVACUADO'

export const FAMILY_STATUS_OPTIONS: { value: FamilyStatus; label: string }[] = [
  { value: 'ACTIVO', label: 'Activa' },
  { value: 'EN_REFUGIO', label: 'En refugio' },
  { value: 'EVACUADO', label: 'Evacuada' },
]

export type FamilyOrderBy = 'priority_score_desc' | 'created_at_desc' | 'family_code_asc'

// Desglose del puntaje de prioridad por factor (HU-08). Claves y máximos según
// server/db/procedures/_helpers/fn_priority_score.sql.
export interface PriorityScoreBreakdown {
  children_under_5: number // máx 32
  adults_over_65: number // máx 24
  pregnant: number // máx 21
  disabled: number // máx 21
  zone_risk: number // máx 20
  total: number // máx 100
}

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
  priority_score_breakdown: PriorityScoreBreakdown
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

// Cuerpo de POST /families (censo, HU-04). El consentimiento Ley 1581/2012 es
// obligatorio (RN-09): el backend exige privacy_consent_accepted === true.
export interface FamilyPayload {
  head_document: string
  zone_id: number
  shelter_id?: number | null
  num_members: number
  num_children_under_5: number
  num_adults_over_65: number
  num_pregnant: number
  num_disabled: number
  status: FamilyStatus
  latitude?: number | null
  longitude?: number | null
  reference_address?: string | null
  privacy_consent_accepted: true
}

// Cuerpo de PUT /families/:id (HU-07). Todos los campos son opcionales en el
// backend; aquí se editan los datos que NO se derivan de las personas. NO
// incluye num_members, composición ni privacy_consent_accepted.
export interface FamilyUpdatePayload {
  head_document?: string
  zone_id?: number
  shelter_id?: number | null
  status?: FamilyStatus
  latitude?: number | null
  longitude?: number | null
  reference_address?: string | null
}
