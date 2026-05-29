import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { RelocationEnriched, RelocationListParams, RelocationPayload } from '@/types/relocation.types'

export const relocationsApi = {
  list(params: RelocationListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.family_id) query.family_id = params.family_id
    if (params.type) query.type = params.type
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<RelocationEnriched>>('/relocations', { params: query }).then((r) => r.data)
  },

  // Origen y autorizado-por los deriva el backend (refugio actual + usuario).
  create(payload: RelocationPayload) {
    return api.post<ApiItem<RelocationEnriched>>('/relocations', payload).then((r) => r.data.data)
  },
}
