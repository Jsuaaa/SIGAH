// Tipos del módulo de donaciones. Reflejan server/src/types/entities.ts.
import type { ResourceCategory } from './inventory.types'
import type { Donor } from './donor.types'

export type DonationType = 'IN_KIND' | 'MONETARY' | 'MIXED'

export const DONATION_TYPE_OPTIONS: { value: DonationType; label: string }[] = [
  { value: 'IN_KIND', label: 'En especie' },
  { value: 'MONETARY', label: 'Monetaria' },
  { value: 'MIXED', label: 'Mixta' },
]

export const DONATION_TYPE_LABELS = Object.fromEntries(
  DONATION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DonationType, string>

export interface DonationDetail {
  id: number
  resource_type_id: number
  resource_name: string
  category: ResourceCategory
  quantity: number
  weight_kg: number
  batch: string | null
  expiration_date?: string | null
}

export interface Donation {
  id: number
  donation_code: string
  donor_id: number
  destination_warehouse_id: number | null
  donation_type: DonationType
  monetary_amount: string | null // pg NUMERIC → string
  date: string
  notes: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

// GET /donations y /donors/:id/donations devuelven la donación enriquecida con
// el donante y los detalles (la vista del backend es passthrough; pueden faltar
// según el endpoint, por eso son opcionales).
export interface DonationEnriched extends Donation {
  donor?: Donor
  details?: DonationDetail[]
}

// Línea de ítem que envía el formulario (el peso lo calcula el backend si se omite).
export interface DonationDetailInput {
  resource_type_id: number
  quantity: number
  batch?: string | null
  expiration_date?: string | null
}

// Cuerpo de POST /donations. Campos condicionales según donation_type:
//  - IN_KIND  → destination_warehouse_id + details (sin monetary_amount)
//  - MONETARY → monetary_amount (sin bodega ni details)
//  - MIXED    → ambos
export interface DonationPayload {
  donor_id: number
  donation_type: DonationType
  date: string
  notes?: string | null
  destination_warehouse_id?: number
  monetary_amount?: string
  details?: DonationDetailInput[]
}

export interface DonationListParams {
  page: number
  limit: number
  donor_id?: number
  type?: DonationType
  date_from?: string
  date_to?: string
}
