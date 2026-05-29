// Tipos del módulo de entregas. Por ahora solo lo necesario para el historial de
// entregas de una familia (HU-08); el módulo de Entregas (paso 9) lo ampliará.

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
  details?: DeliveryDetail[]
}
