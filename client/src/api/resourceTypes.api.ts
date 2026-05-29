import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { ResourceType, ResourceTypeListParams, ResourceTypePayload } from '@/types/inventory.types'

export const resourceTypesApi = {
  // GET /resource-types (sin paginación; devuelve el catálogo completo).
  list(params: ResourceTypeListParams = {}) {
    const query: Record<string, string> = {}
    if (params.category) query.category = params.category
    if (params.is_active !== undefined) query.is_active = String(params.is_active)
    return api.get<ApiItem<ResourceType[]>>('/resource-types', { params: query }).then((r) => r.data.data)
  },

  create(payload: ResourceTypePayload) {
    return api.post<ApiItem<ResourceType>>('/resource-types', payload).then((r) => r.data.data)
  },

  // PUT acepta también is_active (reactivar un recurso desactivado).
  update(id: number, payload: Partial<ResourceTypePayload> & { is_active?: boolean }) {
    return api.put<ApiItem<ResourceType>>(`/resource-types/${id}`, payload).then((r) => r.data.data)
  },

  // DELETE = soft delete (is_active=false) para preservar el histórico (HU-14 CA4).
  deactivate(id: number) {
    return api.delete(`/resource-types/${id}`).then(() => undefined)
  },
}
