// Traslados entre refugios — HU-24 / RF-15. Espejo del ENUM relocation_type y de
// las vistas del backend (server/src/types/entities.ts → RELOCATION_TYPES,
// server/db/procedures/relocations/*.sql). Los valores del enum no se traducen;
// solo la etiqueta visible.

import type { FamilyStatus } from '@/types/family.types'
import type { Role } from '@/types/auth.types'

export type RelocationType = 'TEMPORARY' | 'PERMANENT'

export const RELOCATION_TYPE_OPTIONS: { value: RelocationType; label: string }[] = [
  { value: 'TEMPORARY', label: 'Temporal' },
  { value: 'PERMANENT', label: 'Permanente' },
]

export const RELOCATION_TYPE_LABELS = Object.fromEntries(
  RELOCATION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<RelocationType, string>

// Snapshots embebidos en el listado/detalle (fn_relocations_list /
// fn_relocations_find_by_id). El listado trae menos campos del refugio que el
// detalle, por eso los campos extra son opcionales.
export interface RelocationFamilySnapshot {
  id: number
  family_code: string
  head_document?: string
  num_members: number
  status: FamilyStatus
  zone_id?: number
}

export interface RelocationShelterSnapshot {
  id: number
  name: string
  address?: string
  max_capacity?: number
  current_occupancy?: number
}

export interface RelocationAuthorizedBy {
  id: number
  name: string
  role: Role
}

// Traslado tal como lo devuelven GET /relocations y GET /relocations/:id.
export interface Relocation {
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
  updated_at: string
  family?: RelocationFamilySnapshot
  origin_shelter?: RelocationShelterSnapshot | null
  destination_shelter?: RelocationShelterSnapshot
  authorized_by_user?: RelocationAuthorizedBy
}

// Cuerpo de POST /relocations (HU-24, transaccional). Espejo de
// server/src/validators/relocations.validator.ts → applyRules.
//   El refugio ORIGEN no se envía: el backend lo deriva del refugio actual de la
//   familia (sp_relocation_apply usa v_family.shelter_id).
export interface RelocationPayload {
  family_id: number
  destination_shelter_id: number
  type: RelocationType
  reason: string
  notes?: string | null
}

// Parámetros de GET /relocations (controller.list): filtros opcionales por
// familia, refugio (origen o destino), tipo y rango de fechas, con paginación.
export interface RelocationListParams {
  page?: number
  limit?: number
  family_id?: number
  shelter_id?: number
  type?: RelocationType
  date_from?: string
  date_to?: string
}
