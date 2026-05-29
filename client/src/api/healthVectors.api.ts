import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  HealthVector, HealthVectorEnriched, HealthVectorListParams, HealthVectorPayload, HealthVectorStatus,
} from '@/types/healthVector.types'

export const healthVectorsApi = {
  list(params: HealthVectorListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.status) query.status = params.status
    if (params.risk_level) query.risk_level = params.risk_level
    if (params.vector_type) query.vector_type = params.vector_type
    return api.get<ApiList<HealthVectorEnriched>>('/health-vectors', { params: query }).then((r) => r.data)
  },

  create(payload: HealthVectorPayload) {
    return api.post<ApiItem<HealthVector>>('/health-vectors', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<HealthVectorPayload> & { actions_taken?: string | null }) {
    return api.put<ApiItem<HealthVector>>(`/health-vectors/${id}`, payload).then((r) => r.data.data)
  },

  setStatus(id: number, status: HealthVectorStatus, actions_taken?: string | null) {
    return api
      .put<ApiItem<HealthVector>>(`/health-vectors/${id}/status`, { status, ...(actions_taken ? { actions_taken } : {}) })
      .then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/health-vectors/${id}`).then(() => undefined)
  },
}
