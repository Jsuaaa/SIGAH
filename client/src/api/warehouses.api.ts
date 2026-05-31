import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  Warehouse,
  WarehouseInventoryRow,
  WarehouseListParams,
  WarehousePayload,
} from '@/types/warehouse.types'

export const warehousesApi = {
  // Todas las bodegas para selects/joins.
  listAll() {
    return api
      .get<ApiList<Warehouse>>('/warehouses', { params: { page: 1, limit: 200 } })
      .then((r) => r.data.data)
  },

  // Listado paginado/filtrable para la página de Bodegas.
  list(params: WarehouseListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.status) query.status = params.status
    if (params.search) query.search = params.search
    return api.get<ApiList<Warehouse>>('/warehouses', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<Warehouse>>(`/warehouses/${id}`).then((r) => r.data.data)
  },

  getInventory(id: number) {
    return api
      .get<ApiList<WarehouseInventoryRow>>(`/warehouses/${id}/inventory`)
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
