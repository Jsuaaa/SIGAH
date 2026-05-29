import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  Shelter,
  ShelterListParams,
  ShelterPayload,
  ShelterWithOccupancy,
} from '@/types/shelter.types'

export const sheltersApi = {
  // Todos los refugios para selects/joins (p. ej. formulario de familia).
  listAll() {
    return api
      .get<ApiList<ShelterWithOccupancy>>('/shelters', { params: { page: 1, limit: 200 } })
      .then((r) => r.data.data)
  },

  // Listado paginado/filtrable para la página de Refugios.
  list(params: ShelterListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.type) query.type = params.type
    if (params.search) query.search = params.search
    return api.get<ApiList<ShelterWithOccupancy>>('/shelters', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<ShelterWithOccupancy>>(`/shelters/${id}`).then((r) => r.data.data)
  },

  create(payload: ShelterPayload) {
    return api.post<ApiItem<Shelter>>('/shelters', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<ShelterPayload>) {
    return api.put<ApiItem<Shelter>>(`/shelters/${id}`, payload).then((r) => r.data.data)
  },

  // Actualiza solo la ocupación (valida <= max_capacity en el backend, HU-10).
  setOccupancy(id: number, currentOccupancy: number) {
    return api
      .put<ApiItem<Shelter>>(`/shelters/${id}/occupancy`, { current_occupancy: currentOccupancy })
      .then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/shelters/${id}`).then(() => undefined)
  },
}
