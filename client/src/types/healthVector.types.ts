// Tipos de vectores sanitarios (HU-25/26).
import type { RiskLevel } from './zone.types'

export type VectorType = 'AGUA_CONTAMINADA' | 'INSECTOS' | 'ROEDORES' | 'OTRO'
export type HealthVectorStatus = 'ACTIVO' | 'EN_ATENCION' | 'RESUELTO'

export const VECTOR_TYPE_OPTIONS: { value: VectorType; label: string }[] = [
  { value: 'AGUA_CONTAMINADA', label: 'Agua contaminada' },
  { value: 'INSECTOS', label: 'Insectos' },
  { value: 'ROEDORES', label: 'Roedores' },
  { value: 'OTRO', label: 'Otro' },
]
export const VECTOR_TYPE_LABELS = Object.fromEntries(
  VECTOR_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<VectorType, string>

export const VECTOR_STATUS_OPTIONS: { value: HealthVectorStatus; label: string }[] = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'EN_ATENCION', label: 'En atención' },
  { value: 'RESUELTO', label: 'Resuelto' },
]
export const VECTOR_STATUS_LABELS = Object.fromEntries(
  VECTOR_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<HealthVectorStatus, string>

// Clases del badge por estado (verde resuelto, ámbar en atención, rojo activo).
export const VECTOR_STATUS_BADGE: Record<HealthVectorStatus, string> = {
  ACTIVO: 'bg-danger-bg text-danger border-danger-br',
  EN_ATENCION: 'bg-warning-bg text-warning border-warning-br',
  RESUELTO: 'bg-success-bg text-success border-success-br',
}

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
  created_at?: string
  updated_at?: string
}

export interface HealthVectorEnriched extends HealthVector {
  zone?: { id: number; name: string } | null
  shelter?: { id: number; name: string } | null
}

export interface HealthVectorListParams {
  page: number
  limit: number
  zone_id?: number
  status?: HealthVectorStatus
  risk_level?: RiskLevel
  vector_type?: VectorType
}

export interface HealthVectorPayload {
  vector_type: VectorType
  risk_level: RiskLevel
  description?: string | null
  latitude?: number | null
  longitude?: number | null
  zone_id?: number | null
  shelter_id?: number | null
  reported_date?: string
}
