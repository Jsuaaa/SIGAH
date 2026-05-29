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

// Cuerpo de POST /families. El consentimiento de privacidad es obligatorio y
// debe ser true (RN-09, Ley 1581/2012). En el alta se aceptan los conteos de
// composición agregados (censo rápido HU-04); luego se derivan de las personas.
export interface FamilyCreatePayload {
  head_document: string
  zone_id: number
  shelter_id: number | null
  num_members: number
  num_children_under_5: number
  num_adults_over_65: number
  num_pregnant: number
  num_disabled: number
  status: FamilyStatus
  latitude: number | null
  longitude: number | null
  reference_address: string | null
  privacy_consent_accepted: true
}

// Cuerpo de PUT /families/:id. No incluye num_members ni los conteos: esos se
// recalculan desde las personas (#14) y se gestionan en la pestaña Miembros.
export interface FamilyUpdatePayload {
  head_document?: string
  zone_id?: number
  shelter_id?: number | null
  status?: FamilyStatus
  latitude?: number | null
  longitude?: number | null
  reference_address?: string | null
}

// GET /families/:id/eligibility (RN-02, HU-23). Misma forma que la elegibilidad
// de entregas: indica si la familia puede recibir una nueva entrega.
export interface FamilyEligibility {
  is_eligible: boolean
  reason: string
  last_delivery_at: string | null
  coverage_expires: string | null
  days_remaining: number | null
  next_eligible_at: string | null
}

// Forma del priority_score_breakdown que produce fn_priority_score: una
// contribución por factor (puntos) + inputs/weights crudos (HU-08 CA2).
export interface FamilyScoreBreakdown {
  members: number
  children_u5: number
  adults_o65: number
  pregnant: number
  disabled: number
  zone_risk: number
  days_no_aid: number
  deliveries: number
  inputs: {
    num_members: number
    num_children_under_5: number
    num_adults_over_65: number
    num_pregnant: number
    num_disabled: number
    zone_risk_factor: number
    days_without_aid: number
    deliveries_received: number
    max_days: number
  }
  weights: Record<string, number>
}
