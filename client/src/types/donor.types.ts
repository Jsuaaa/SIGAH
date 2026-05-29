// Tipos del módulo de donantes. Reflejan server/src/types/entities.ts.

export type DonorType = 'PERSONA_NATURAL' | 'EMPRESA' | 'ALCALDIA' | 'GOBERNACION' | 'ORGANIZACION'

export const DONOR_TYPE_OPTIONS: { value: DonorType; label: string }[] = [
  { value: 'PERSONA_NATURAL', label: 'Persona natural' },
  { value: 'EMPRESA', label: 'Empresa' },
  { value: 'ALCALDIA', label: 'Alcaldía' },
  { value: 'GOBERNACION', label: 'Gobernación' },
  { value: 'ORGANIZACION', label: 'Organización' },
]

export const DONOR_TYPE_LABELS = Object.fromEntries(
  DONOR_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DonorType, string>

export interface Donor {
  id: number
  name: string
  type: DonorType
  contact: string
  tax_id: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface DonorListParams {
  page: number
  limit: number
  type?: DonorType
  is_active?: boolean
  search?: string
}

// Cuerpo de POST/PUT /donors. Único por (name, type) (HU-18 CA3).
export interface DonorPayload {
  name: string
  type: DonorType
  contact: string
  tax_id: string | null
}
