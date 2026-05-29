import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  Warehouse,
  WarehouseListParams,
  WarehousePayload,
  WarehouseWithDistance,
  WarehouseWithOccupancy,
} from '@/types/warehouse.types'
import type { InventoryRow } from '@/types/inventory.types'

export const warehousesApi = {
  // Catálogo completo para selects/joins (p. ej. resumen, ajustes).
  listAll() {
    return api
      .get<ApiList<WarehouseWithOccupancy>>('/warehouses', { params: { page: 1, limit: 200 } })
      .then((r) => r.data.data)
  },

  list(params: WarehouseListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.status) query.status = params.status
    if (params.search) query.search = params.search
    return api.get<ApiList<WarehouseWithOccupancy>>('/warehouses', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<WarehouseWithOccupancy>>(`/warehouses/${id}`).then((r) => r.data.data)
  },

  inventory(id: number) {
    return api.get<ApiItem<InventoryRow[]>>(`/warehouses/${id}/inventory`).then((r) => r.data.data)
  },

  nearest(lat: number, lng: number, limit = 5) {
    return api
      .get<ApiItem<WarehouseWithDistance[]>>('/warehouses/nearest', { params: { lat, lng, limit } })
      .then((r) => r.data.data)
  },

  create(payload: WarehousePayload) {
    return api.post<ApiItem<Warehouse>>('/warehouses', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<WarehousePayload>) {
    return api.put<ApiItem<Warehouse>>(`/warehouses/${id}`, payload).then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/warehouses/${id}`).then(() => undefined)
  },
}
