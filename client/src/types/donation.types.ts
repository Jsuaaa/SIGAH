// Donaciones — HU-19. Espejo del contrato del backend:
//   - ENUM donation_type: server/src/types/entities.ts → DONATION_TYPES.
//   - Vista/listado: fn_donations_list.sql y fn_donations_find_by_id.sql (cada
//     fila trae las columnas de `donations` + `donor` + `details[]`).
//   - Cuerpo del POST: server/src/validators/donations.validator.ts y
//     server/db/procedures/donations/sp_donations_create.sql.
// El valor del enum NO se traduce; solo la etiqueta visible.

import type { ResourceCategory } from '@/types/resourceType.types'

export type DonationType = 'IN_KIND' | 'MONETARY' | 'MIXED'

export const DONATION_TYPE_OPTIONS: { value: DonationType; label: string }[] = [
  { value: 'IN_KIND', label: 'En especie' },
  { value: 'MONETARY', label: 'Monetaria' },
  { value: 'MIXED', label: 'Mixta' },
]

export const DONATION_TYPE_LABELS = Object.fromEntries(
  DONATION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DonationType, string>

// Clases Tailwind por tipo para el badge de la tabla (mismo lenguaje visual que
// los demás badges del proyecto).
export const DONATION_TYPE_BADGE: Record<DonationType, string> = {
  IN_KIND: 'text-primary-700 bg-info-bg border-info-br',
  MONETARY: 'text-success bg-success-bg border-success-br',
  MIXED: 'text-warning bg-warning-bg border-warning-br',
}

// Item (renglón) de una donación tal como lo devuelve el backend dentro de
// `details` (fn_donations_*). Es la forma enriquecida con nombre y categoría del
// recurso y el peso ya calculado.
export interface DonationItem {
  id: number
  resource_type_id: number
  resource_name: string
  category: ResourceCategory
  quantity: number
  weight_kg: number
  batch: string | null
  expiration_date: string | null
}

// Donante embebido en la donación (subconjunto usado en las vistas de donación).
export interface DonationDonor {
  id: number
  name: string
  type: string
  contact?: string
  tax_id?: string | null
  is_active?: boolean
}

// Donación tal como la devuelven GET /donations (cada fila) y GET /donations/:id.
// monetary_amount llega como string (pg NUMERIC) o null. weight total no viene del
// backend: se calcula en el cliente sumando details[].weight_kg.
export interface Donation {
  id: number
  donation_code: string
  donor_id: number
  destination_warehouse_id: number | null
  donation_type: DonationType
  monetary_amount: string | null
  date: string
  notes: string | null
  created_by: number | null
  created_at?: string
  updated_at?: string
  donor?: DonationDonor
  details: DonationItem[]
}

// Renglón de items en el cuerpo del POST. weight_kg es opcional: si se omite, el
// backend lo deriva de resource_types.unit_weight_kg (sp_donations_create).
export interface DonationItemPayload {
  resource_type_id: number
  quantity: number
  batch?: string | null
  expiration_date?: string | null
}

// Cuerpo de POST /donations. Campos EXACTOS del validador del backend:
//   - destination_warehouse_id: requerido para IN_KIND/MIXED (bodega destino).
//   - monetary_amount: requerido para MONETARY/MIXED; ausente para IN_KIND.
//   - details: requerido (>=1) para IN_KIND/MIXED; ausente para MONETARY.
// El código DON lo genera el backend (fn_next_code).
export interface DonationPayload {
  donor_id: number
  donation_type: DonationType
  destination_warehouse_id?: number | null
  monetary_amount?: string | number | null
  date?: string | null
  notes?: string | null
  details?: DonationItemPayload[]
}

// Parámetros de GET /donations (controller.list). Filtros opcionales por donante,
// bodega, tipo y rango de fechas, con paginación. Nombres exactos del controller:
// donor_id, warehouse_id, type, date_from, date_to.
export interface DonationListParams {
  page: number
  limit: number
  donor_id?: number
  warehouse_id?: number
  type?: DonationType
  date_from?: string
  date_to?: string
}
