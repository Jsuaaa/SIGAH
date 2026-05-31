import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  ResourceType,
  ResourceTypeListParams,
  ResourceTypePayload,
} from '@/types/resourceType.types'

export const resourceTypesApi = {
  // Catálogo completo (solo activos) para selects de Inventario/Donaciones.
  listAll() {
    return api
      .get<ApiList<ResourceType>>('/resource-types', {
        params: { page: 1, limit: 200, is_active: true },
      })
      .then((r) => r.data.data)
  },

  // Listado paginado/filtrable para la página de Tipos de recurso (incluye
  // inactivos cuando no se filtra por is_active).
  list(params: ResourceTypeListParams) {
    const query: Record<string, string | number | boolean> = {
      page: params.page,
      limit: params.limit,
    }
    if (params.category) query.category = params.category
    if (params.is_active !== undefined) query.is_active = params.is_active
    if (params.search) query.search = params.search
    return api.get<ApiList<ResourceType>>('/resource-types', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<ResourceType>>(`/resource-types/${id}`).then((r) => r.data.data)
  },

  create(payload: ResourceTypePayload) {
    return api.post<ApiItem<ResourceType>>('/resource-types', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<ResourceTypePayload>) {
    return api.put<ApiItem<ResourceType>>(`/resource-types/${id}`, payload).then((r) => r.data.data)
  },

  // Soft-delete: el backend marca is_active=false (HU-14 CA4). No hay borrado físico.
  remove(id: number) {
    return api.delete(`/resource-types/${id}`).then(() => undefined)
  },
}
