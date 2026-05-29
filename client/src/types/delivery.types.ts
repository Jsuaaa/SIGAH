// Tipos del módulo de entregas (HU-22/23/12).
import type { Family, FamilyStatus } from './family.types'

export type DeliveryStatus = 'PROGRAMADA' | 'EN_CURSO' | 'ENTREGADA'

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  ENTREGADA: 'Entregada',
}

// Color del badge por estado (gris · azul · verde, FRONTEND-PLAN §3.7).
export const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, 'slate' | 'blue' | 'green'> = {
  PROGRAMADA: 'slate',
  EN_CURSO: 'blue',
  ENTREGADA: 'green',
}

export const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'PROGRAMADA', label: 'Programada' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'ENTREGADA', label: 'Entregada' },
]

export interface DeliveryDetail {
  id: number
  resource_type_id: number
  resource_name: string
  category: string
  quantity: number
  weight_kg: number
  batch: string | null
}

export interface Delivery {
  id: number
  delivery_code: string
  family_id: number
  source_warehouse_id: number
  plan_item_id: number | null
  delivery_date: string
  delivered_by: number | null
  received_by_document: string | null
  coverage_days: number
  status: DeliveryStatus
  delivery_latitude: number | null
  delivery_longitude: number | null
  exception_reason: string | null
  exception_authorized_by: number | null
  client_op_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // El backend incluye los detalles en list/getById/by-family.
  details?: DeliveryDetail[]
}

export interface DeliveryEnriched extends Delivery {
  family?: Pick<Family, 'id' | 'family_code' | 'head_document' | 'zone_id'> & { status?: FamilyStatus }
  warehouse?: { id: number; name: string }
}

// Elegibilidad (RN-02, HU-23). Igual forma que /families/:id/eligibility.
export interface DeliveryEligibility {
  is_eligible: boolean
  reason: string
  last_delivery_at: string | null
  coverage_expires: string | null
  days_remaining: number | null
  next_eligible_at: string | null
}

export interface DeliveryDetailInput {
  resource_type_id: number
  quantity: number
  batch?: string | null
}

// POST /deliveries (entrega regular). client_op_id habilita idempotencia offline.
export interface DeliveryPayload {
  family_id: number
  source_warehouse_id: number
  coverage_days: number
  received_by_document?: string | null
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  notes?: string | null
  client_op_id?: string | null
  details: DeliveryDetailInput[]
}

// POST /deliveries/exception (solo COORDINADOR_LOGISTICA). Requiere
// exception_reason + exception_authorized_by (id del coordinador).
export interface ExceptionPayload {
  family_id: number
  source_warehouse_id: number
  coverage_days: number
  exception_reason: string
  exception_authorized_by: number
  received_by_document?: string | null
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  notes?: string | null
  details: DeliveryDetailInput[]
}

export interface DeliveryListParams {
  page: number
  limit: number
  family_id?: number
  warehouse_id?: number
  status?: DeliveryStatus
  date_from?: string
  date_to?: string
}

// GET /prioritization/next-batch?count=N — vista previa del lote.
export interface NextBatchRow {
  id: number
  family_code: string
  head_document: string
  zone_id: number
  zone_name: string
  shelter_id: number | null
  num_members: number
  priority_score: number
  status: FamilyStatus
  last_delivery_date: string | null
  eligibility: { is_eligible: boolean; reason: string; next_eligible_at: string | null }
}

export interface BatchResult {
  created: number
  deliveries?: Delivery[]
}
