import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { Zone, ZoneListParams, ZonePayload, ZoneWarehouse } from '@/types/zone.types'
import type { Family } from '@/types/family.types'
import type { ShelterWithOccupancy } from '@/types/shelter.types'

export const zonesApi = {
  // Catálogo completo (Montería tiene pocas zonas): para selects y joins en cliente.
  listAll() {
    return api.get<ApiList<Zone>>('/zones', { params: { page: 1, limit: 100 } }).then((r) => r.data.data)
  },

  // Listado paginado/filtrable para la página de Zonas.
  list(params: ZoneListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.risk_level) query.risk_level = params.risk_level
    if (params.search) query.search = params.search
    return api.get<ApiList<Zone>>('/zones', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<Zone>>(`/zones/${id}`).then((r) => r.data.data)
  },

  create(payload: ZonePayload) {
    return api.post<ApiItem<Zone>>('/zones', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<ZonePayload>) {
    return api.put<ApiItem<Zone>>(`/zones/${id}`, payload).then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/zones/${id}`).then(() => undefined)
  },

  // Relaciones (tabs del detalle): el backend devuelve arrays sin paginación.
  families(id: number) {
    return api.get<ApiItem<Family[]>>(`/zones/${id}/families`).then((r) => r.data.data)
  },
  shelters(id: number) {
    return api.get<ApiItem<ShelterWithOccupancy[]>>(`/zones/${id}/shelters`).then((r) => r.data.data)
  },
  warehouses(id: number) {
    return api.get<ApiItem<ZoneWarehouse[]>>(`/zones/${id}/warehouses`).then((r) => r.data.data)
  },
}
