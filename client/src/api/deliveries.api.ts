import { api, idempotent } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  BatchResult,
  Delivery,
  DeliveryEligibility,
  DeliveryEnriched,
  DeliveryListParams,
  DeliveryPayload,
  DeliveryStatus,
  ExceptionPayload,
  NextBatchRow,
} from '@/types/delivery.types'

export const deliveriesApi = {
  list(params: DeliveryListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.family_id) query.family_id = params.family_id
    if (params.warehouse_id) query.warehouse_id = params.warehouse_id
    if (params.status) query.status = params.status
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<DeliveryEnriched>>('/deliveries', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<DeliveryEnriched>>(`/deliveries/${id}`).then((r) => r.data.data)
  },

  eligibility(familyId: number) {
    return api
      .get<ApiItem<DeliveryEligibility>>('/deliveries/eligibility', { params: { family_id: familyId } })
      .then((r) => r.data.data)
  },

  // Vista previa del próximo lote (top-N priorizadas con elegibilidad).
  nextBatch(count: number) {
    return api
      .get<ApiItem<NextBatchRow[]>>('/prioritization/next-batch', { params: { count } })
      .then((r) => r.data.data)
  },

  create(payload: DeliveryPayload, clientOpId?: string) {
    return api
      .post<ApiItem<Delivery>>('/deliveries', payload, clientOpId ? idempotent(clientOpId) : undefined)
      .then((r) => r.data.data)
  },

  createException(payload: ExceptionPayload) {
    return api.post<ApiItem<Delivery>>('/deliveries/exception', payload).then((r) => r.data.data)
  },

  // POST /deliveries/batch crea las top-N priorizadas (solo { count }).
  createBatch(count: number) {
    return api.post<ApiItem<BatchResult>>('/deliveries/batch', { count }).then((r) => r.data.data)
  },

  updateStatus(id: number, status: DeliveryStatus, received_by_document?: string) {
    return api
      .put<ApiItem<Delivery>>(`/deliveries/${id}/status`, {
        status,
        ...(received_by_document ? { received_by_document } : {}),
      })
      .then((r) => r.data.data)
  },
}
