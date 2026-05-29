import { api, idempotent } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  Family,
  FamilyCreatePayload,
  FamilyEligibility,
  FamilyListParams,
  FamilyUpdatePayload,
} from '@/types/family.types'
import type { Person } from '@/types/person.types'
import type { Delivery } from '@/types/delivery.types'

export const familiesApi = {
  // GET /families con filtros (zona, refugio, estado, orden). Ignora `q`:
  // la búsqueda de texto va por el endpoint /families/search.
  list(params: FamilyListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.shelter_id) query.shelter_id = params.shelter_id
    if (params.status) query.status = params.status
    if (params.order_by) query.order_by = params.order_by
    return api.get<ApiList<Family>>('/families', { params: query }).then((r) => r.data)
  },

  // GET /families/search?q= — búsqueda unificada por código / documento / dirección (RNF-04).
  search(params: FamilyListParams) {
    return api
      .get<ApiList<Family>>('/families/search', {
        params: { q: params.q, page: params.page, limit: params.limit },
      })
      .then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<Family>>(`/families/${id}`).then((r) => r.data.data)
  },

  // POST /families. `clientOpId` (uuid) habilita la idempotencia del backend
  // para reintentos en redes inestables / sincronización offline (HU-04 CA5).
  create(payload: FamilyCreatePayload, clientOpId?: string) {
    return api
      .post<ApiItem<Family>>('/families', payload, clientOpId ? idempotent(clientOpId) : undefined)
      .then((r) => r.data.data)
  },

  update(id: number, payload: FamilyUpdatePayload) {
    return api.put<ApiItem<Family>>(`/families/${id}`, payload).then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/families/${id}`).then(() => undefined)
  },

  // Sub-recursos del detalle de familia.
  listPersons(id: number) {
    return api.get<ApiItem<Person[]>>(`/families/${id}/persons`).then((r) => r.data.data)
  },

  listDeliveries(id: number) {
    return api.get<ApiItem<Delivery[]>>(`/families/${id}/deliveries`).then((r) => r.data.data)
  },

  getEligibility(id: number) {
    return api.get<ApiItem<FamilyEligibility>>(`/families/${id}/eligibility`).then((r) => r.data.data)
  },
}
