import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  Relocation,
  RelocationListParams,
  RelocationPayload,
} from '@/types/relocation.types'

export const relocationsApi = {
  // GET /relocations — listado paginado/filtrable de traslados (HU-24 CA4).
  list(params: RelocationListParams) {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    }
    if (params.family_id) query.family_id = params.family_id
    if (params.shelter_id) query.shelter_id = params.shelter_id
    if (params.type) query.type = params.type
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<Relocation>>('/relocations', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<Relocation>>(`/relocations/${id}`).then((r) => r.data.data)
  },

  // POST /relocations — aplica un traslado de forma transaccional. El backend
  // devuelve SH409 (HTTP 409) si el refugio destino no tiene capacidad (HU-24 CA3)
  // y SH422 si la familia ya está en ese refugio.
  apply(payload: RelocationPayload) {
    return api.post<ApiItem<Relocation>>('/relocations', payload).then((r) => r.data.data)
  },
}
