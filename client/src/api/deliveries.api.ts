import { api, idempotent } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { Family } from '@/types/family.types'
import type {
  Delivery,
  DeliveryBatchPayload,
  DeliveryBatchResult,
  DeliveryEligibility,
  DeliveryExceptionPayload,
  DeliveryListParams,
  DeliveryPayload,
  DeliveryStatusPayload,
  NearestWarehouse,
} from '@/types/delivery.types'

export const deliveriesApi = {
  // GET /deliveries — listado paginado con filtros. Nombres de query EXACTOS del controller:
  // family_id, warehouse_id, status, date_from, date_to.
  list(params: DeliveryListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.family_id) query.family_id = params.family_id
    if (params.warehouse_id) query.warehouse_id = params.warehouse_id
    if (params.status) query.status = params.status
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<Delivery>>('/deliveries', { params: query }).then((r) => r.data)
  },

  // GET /deliveries/:id — detalle de la entrega con familia, bodega y items.
  getById(id: number) {
    return api.get<ApiItem<Delivery>>(`/deliveries/${id}`).then((r) => r.data.data)
  },

  // GET /deliveries/eligibility?family_id= — elegibilidad de la familia (RN-02, HU-23 CA2).
  // El backend lanza 404 si la familia no existe.
  eligibility(familyId: number) {
    return api
      .get<ApiItem<DeliveryEligibility>>('/deliveries/eligibility', {
        params: { family_id: familyId },
      })
      .then((r) => r.data.data)
  },

  // POST /deliveries — entrega regular (HU-22). El backend valida elegibilidad antes de crear
  // (rechaza con 409 si la familia tiene cobertura vigente), descuenta inventario (RN-05) y
  // exige la ración mínima de alimentos (RN-01). El código ENT lo genera el backend.
  //
  // Modo ONLINE: opcionalmente enviamos la cabecera Idempotency-Key para que reintentos de red
  // no dupliquen la entrega (el backend deduplica por client_op_id). El flujo offline real es
  // una fase posterior.
  create(payload: DeliveryPayload, clientOpId?: string) {
    return api
      .post<ApiItem<Delivery>>('/deliveries', payload, clientOpId ? idempotent(clientOpId) : undefined)
      .then((r) => r.data.data)
  },

  // POST /deliveries/exception — entrega con excepción a la cobertura vigente (HU-23 CA5).
  // Solo COORDINADOR_LOGISTICA. Requiere exception_reason y exception_authorized_by.
  createException(payload: DeliveryExceptionPayload) {
    return api
      .post<ApiItem<Delivery>>('/deliveries/exception', payload)
      .then((r) => r.data.data)
  },

  // PUT /deliveries/:id/status — transición de estado (PROGRAMADA → EN_CURSO → ENTREGADA).
  updateStatus(id: number, payload: DeliveryStatusPayload) {
    return api
      .put<ApiItem<Delivery>>(`/deliveries/${id}/status`, payload)
      .then((r) => r.data.data)
  },

  // GET /prioritization/next-batch?limit= — previsualiza las top N familias priorizadas
  // elegibles que el lote atendería (mismas familias que usa sp_delivery_create_batch vía
  // fn_prioritization_next_batch). Solo lectura para mostrar la previsualización del lote.
  nextBatchPreview(limit: number) {
    return api
      .get<ApiList<Family>>('/prioritization/next-batch', { params: { limit } })
      .then((r) => r.data.data)
  },

  // POST /deliveries/batch — crea entregas para las top N familias priorizadas elegibles
  // (HU-23 lote). ADMIN o COORDINADOR_LOGISTICA. Devuelve cuántas se crearon/omitieron.
  batch(payload: DeliveryBatchPayload) {
    return api
      .post<ApiItem<DeliveryBatchResult>>('/deliveries/batch', payload)
      .then((r) => r.data.data)
  },

  // GET /warehouses/nearest?lat&lng&limit — bodegas más cercanas con stock (HU-12). Reutiliza
  // el endpoint de warehouses sin tocar warehouses.api. Lista vacía => sin disponibilidad.
  nearestWarehouses(lat: number, lng: number, limit = 5) {
    return api
      .get<ApiList<NearestWarehouse>>('/warehouses/nearest', { params: { lat, lng, limit } })
      .then((r) => r.data.data)
  },
}
