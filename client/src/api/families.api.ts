import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { Family, FamilyListParams } from '@/types/family.types'

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
}
