// Entregas — Épica de Entregas (HU-22 registrar entrega, HU-23 duplicidad/excepción/lote,
// HU-12 bodega más cercana). Espejo EXACTO del contrato del backend; los nombres de los
// campos NO se traducen.
//
// Fuentes de verdad:
//   - ENUM delivery_status:        server/src/types/entities.ts → DELIVERY_STATUSES.
//   - Vista/listado y detalle:     server/db/procedures/deliveries/fn_deliveries_list.sql y
//                                   fn_deliveries_find_by_id.sql (cada fila = columnas de
//                                   `deliveries` + `family` + `warehouse` + `details[]`).
//   - Cuerpo de POST /deliveries:  server/src/validators/deliveries.validator.ts
//                                   (createDeliveryRules) y sp_delivery_create.sql.
//   - Excepción:                   createExceptionRules + sp_delivery_create_exception.sql.
//   - Lote:                        batchRules ({ count }) + sp_delivery_create_batch.sql.
//   - Elegibilidad:                GET /deliveries/eligibility → fn_delivery_check_eligibility.sql.
//   - Bodega más cercana (HU-12):  GET /warehouses/nearest → fn_warehouses_nearest.sql.

import type { ResourceCategory } from '@/types/resourceType.types'
import type { Family } from '@/types/family.types'
import type { Warehouse } from '@/types/warehouse.types'

// Estado de una entrega (enum del backend, no se traduce el valor).
export type DeliveryStatus = 'PROGRAMADA' | 'EN_CURSO' | 'ENTREGADA'

export const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'PROGRAMADA', label: 'Programada' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'ENTREGADA', label: 'Entregada' },
]

export const DELIVERY_STATUS_LABELS = Object.fromEntries(
  DELIVERY_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DeliveryStatus, string>

// Renglón (item) de una entrega tal como lo devuelve el backend dentro de `details`
// (fn_deliveries_*). Forma enriquecida con nombre y categoría del recurso y el peso ya
// calculado por el SP (quantity × unit_weight_kg).
export interface DeliveryItem {
  id: number
  resource_type_id: number
  resource_name: string
  category: ResourceCategory
  quantity: number
  weight_kg: number
  batch?: string | null
}

// Entrega tal como la devuelven GET /deliveries (cada fila) y GET /deliveries/:id.
// Son las columnas de la tabla `deliveries` más los objetos anidados `family` y
// `warehouse` (filas completas) y el array `details`. El peso total no viene del backend:
// se calcula en el cliente sumando details[].weight_kg.
export interface Delivery {
  id: number
  delivery_code: string
  family_id: number
  source_warehouse_id: number
  delivered_by: number
  exception_authorized_by: number | null
  exception_reason: string | null
  delivery_date: string
  coverage_days: number
  status: DeliveryStatus
  received_by_document: string | null
  delivery_latitude: number | null
  delivery_longitude: number | null
  client_op_id: string | null
  created_at?: string
  updated_at?: string
  // Anidados por las funciones SQL (to_jsonb de la familia/bodega completas).
  family?: Family
  warehouse?: Warehouse
  details: DeliveryItem[]
}

// Renglón de items en el cuerpo del POST. weight_kg NO se envía: el backend lo deriva de
// resource_types.unit_weight_kg (sp_delivery_create). El validador acepta `batch` opcional.
export interface DeliveryDetailPayload {
  resource_type_id: number
  quantity: number
  batch?: string | null
}

// Cuerpo de POST /deliveries (createDeliveryRules + sp_delivery_create). Campos EXACTOS:
//   - coverage_days: entero >= 3 (RN-01).
//   - details: requerido (>=1) con resource_type_id + quantity.
//   - delivery_latitude/longitude, received_by_document, notes: opcionales.
// La idempotencia online viaja por la cabecera Idempotency-Key (axios `idempotent()`); aquí
// no enviamos client_op_id en el cuerpo (el flujo offline es una fase posterior).
export interface DeliveryPayload {
  family_id: number
  source_warehouse_id: number
  coverage_days: number
  details: DeliveryDetailPayload[]
  received_by_document?: string | null
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  notes?: string | null
}

// Cuerpo de POST /deliveries/exception (createExceptionRules + sp_delivery_create_exception).
// Igual que DeliveryPayload pero con la justificación obligatoria (5-1000 caracteres, HU-23
// CA5) y exception_authorized_by (id del usuario coordinador que autoriza, requerido por el
// validador del backend).
export interface DeliveryExceptionPayload extends DeliveryPayload {
  exception_reason: string
  exception_authorized_by: number
}

// Cuerpo de PUT /deliveries/:id/status (updateStatusRules). Transición de estado
// (PROGRAMADA → EN_CURSO → ENTREGADA).
export interface DeliveryStatusPayload {
  status: DeliveryStatus
  received_by_document?: string | null
}

// Cuerpo de POST /deliveries/batch (batchRules). El backend toma las top `count` familias
// priorizadas elegibles (fn_prioritization_next_batch) y crea una entrega para cada una.
export interface DeliveryBatchPayload {
  count: number
}

// Familia omitida en un lote (sp_delivery_create_batch → skipped_families[]).
export interface DeliveryBatchSkipped {
  family_id: number
  reason: string
}

// Resultado de POST /deliveries/batch (sp_delivery_create_batch).
export interface DeliveryBatchResult {
  created: number
  skipped: number
  skipped_families: DeliveryBatchSkipped[]
}

// Resultado de GET /deliveries/eligibility?family_id= (fn_delivery_check_eligibility).
// `reason` es un código corto del backend: 'ELIGIBLE' | 'COVERED'.
//   - is_eligible:      true si la familia puede recibir una nueva entrega (RN-02).
//   - last_delivery_at: fecha de la última entrega ENTREGADA, null si nunca.
//   - coverage_expires: fin de la cobertura vigente; null si nunca tuvo entrega.
//   - days_remaining:   días enteros hasta coverage_expires (negativo si ya venció).
//   - next_eligible_at: cuándo vuelve a ser elegible; null si ya lo es.
export interface DeliveryEligibility {
  is_eligible: boolean
  reason: string | null
  last_delivery_at: string | null
  coverage_expires: string | null
  days_remaining: number | null
  next_eligible_at: string | null
}

// Parámetros de GET /deliveries (controller.list). Nombres EXACTOS del controller:
// family_id, warehouse_id, status, date_from, date_to. Con paginación.
export interface DeliveryListParams {
  page: number
  limit: number
  family_id?: number
  warehouse_id?: number
  status?: DeliveryStatus
  date_from?: string
  date_to?: string
}

// Bodega devuelta por GET /warehouses/nearest (fn_warehouses_nearest) — HU-12. Son las
// columnas de `warehouses` (vía el tipo Warehouse, que ya incluye is_over_85_percent y
// occupancy_ratio) más la distancia Haversine en km. El endpoint solo devuelve bodegas
// ACTIVE con stock > 0; lista vacía => sin disponibilidad (HU-12 CA4).
export interface NearestWarehouse extends Warehouse {
  distance_km: number
}
