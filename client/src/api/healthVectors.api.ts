import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  HealthVector,
  HealthVectorCreatePayload,
  HealthVectorListParams,
  HealthVectorStatusPayload,
  HealthVectorUpdatePayload,
} from '@/types/healthVector.types'

export const healthVectorsApi = {
  // GET /health-vectors — listado paginado/filtrable (HU-25 CA2).
  list(params: HealthVectorListParams) {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.shelter_id) query.shelter_id = params.shelter_id
    if (params.risk_level) query.risk_level = params.risk_level
    if (params.vector_type) query.vector_type = params.vector_type
    if (params.status) query.status = params.status
    return api.get<ApiList<HealthVector>>('/health-vectors', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<HealthVector>>(`/health-vectors/${id}`).then((r) => r.data.data)
  },

  // POST /health-vectors — reporta un vector (ADMIN o COORDINADOR_LOGISTICA).
  // SH422 si no se provee zona, refugio ni coordenadas.
  create(payload: HealthVectorCreatePayload) {
    return api.post<ApiItem<HealthVector>>('/health-vectors', payload).then((r) => r.data.data)
  },

  update(id: number, payload: HealthVectorUpdatePayload) {
    return api.put<ApiItem<HealthVector>>(`/health-vectors/${id}`, payload).then((r) => r.data.data)
  },

  // PUT /health-vectors/:id/status — cambia el estado + acciones tomadas (HU-25
  // CA3). No se puede reabrir un vector RESUELTO (SH422).
  setStatus(id: number, payload: HealthVectorStatusPayload) {
    return api
      .put<ApiItem<HealthVector>>(`/health-vectors/${id}/status`, payload)
      .then((r) => r.data.data)
  },

  // DELETE /health-vectors/:id — solo ADMIN (responde 204).
  remove(id: number) {
    return api.delete(`/health-vectors/${id}`).then(() => undefined)
  },
}
