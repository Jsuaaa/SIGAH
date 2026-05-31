// Focos sanitarios / vectores de riesgo — HU-25 / RF-26. Espejo de los ENUM
// vector_type, health_vector_status y risk_level del backend
// (server/src/types/entities.ts) y de las vistas
// (server/db/procedures/health_vectors/*.sql). Los valores del enum NO se
// traducen; solo la etiqueta visible. Atención: los enums de tipo y estado están
// en español (AGUA_CONTAMINADA, ACTIVO, …); risk_level está en inglés.

import type { RiskLevel } from '@/types/zone.types'
import type { Zone } from '@/types/zone.types'
import type { Shelter } from '@/types/shelter.types'

export type VectorType = 'AGUA_CONTAMINADA' | 'INSECTOS' | 'ROEDORES' | 'OTRO'

export const VECTOR_TYPE_OPTIONS: { value: VectorType; label: string }[] = [
  { value: 'AGUA_CONTAMINADA', label: 'Agua contaminada' },
  { value: 'INSECTOS', label: 'Insectos' },
  { value: 'ROEDORES', label: 'Roedores' },
  { value: 'OTRO', label: 'Otro' },
]

export const VECTOR_TYPE_LABELS = Object.fromEntries(
  VECTOR_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<VectorType, string>

export type HealthVectorStatus = 'ACTIVO' | 'EN_ATENCION' | 'RESUELTO'

export const HEALTH_VECTOR_STATUS_OPTIONS: { value: HealthVectorStatus; label: string }[] = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'EN_ATENCION', label: 'En atención' },
  { value: 'RESUELTO', label: 'Resuelto' },
]

export const HEALTH_VECTOR_STATUS_LABELS = Object.fromEntries(
  HEALTH_VECTOR_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<HealthVectorStatus, string>

// Clases de badge por estado (mantener consistencia con StatusBadge / sistema).
export const HEALTH_VECTOR_STATUS_BADGE: Record<HealthVectorStatus, string> = {
  ACTIVO: 'text-danger bg-danger-bg border-danger-br',
  EN_ATENCION: 'text-primary-700 bg-info-bg border-info-br',
  RESUELTO: 'text-success bg-success-bg border-success-br',
}

export type { RiskLevel }

// Vector tal como lo devuelven GET /health-vectors y GET /health-vectors/:id.
// El listado/detalle embeben los snapshots completos de zona y refugio.
export interface HealthVector {
  id: number
  vector_type: VectorType
  risk_level: RiskLevel
  status: HealthVectorStatus
  description: string | null
  actions_taken: string | null
  latitude: number | null
  longitude: number | null
  zone_id: number | null
  shelter_id: number | null
  reported_date: string
  reported_by: number
  resolved_at: string | null
  created_at: string
  updated_at: string
  zone?: Zone | null
  shelter?: Shelter | null
}

// Cuerpo de POST /health-vectors (RF-26/HU-25 CA1). Espejo de
// server/src/validators/healthVectors.validator.ts → createRules.
//   Debe incluir al menos zone_id, shelter_id o (latitude + longitude) — SH422.
export interface HealthVectorCreatePayload {
  vector_type: VectorType
  risk_level: RiskLevel
  description?: string | null
  latitude?: number | null
  longitude?: number | null
  zone_id?: number | null
  shelter_id?: number | null
  reported_date?: string | null
}

// Cuerpo de PUT /health-vectors/:id (updateRules). El estado NO se edita aquí; se
// cambia con el endpoint dedicado de estado.
export interface HealthVectorUpdatePayload {
  vector_type?: VectorType
  risk_level?: RiskLevel
  description?: string | null
  actions_taken?: string | null
  latitude?: number | null
  longitude?: number | null
  zone_id?: number | null
  shelter_id?: number | null
}

// Cuerpo de PUT /health-vectors/:id/status (setStatusRules, HU-25 CA3).
//   status        : obligatorio (no se puede reabrir un RESUELTO — SH422).
//   actions_taken : acciones tomadas (se exige en la UI al cambiar de estado).
export interface HealthVectorStatusPayload {
  status: HealthVectorStatus
  actions_taken?: string | null
}

// Parámetros de GET /health-vectors (controller.list): filtros opcionales.
export interface HealthVectorListParams {
  page?: number
  limit?: number
  zone_id?: number
  shelter_id?: number
  risk_level?: RiskLevel
  vector_type?: VectorType
  status?: HealthVectorStatus
}
