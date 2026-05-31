import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  InventoryListParams,
  InventoryRow,
  InventorySummaryRow,
} from '@/types/inventory.types'

export const inventoryApi = {
  // Listado paginado/filtrable de inventario (GET /inventory).
  list(params: InventoryListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.warehouse_id) query.warehouse_id = params.warehouse_id
    if (params.resource_type_id) query.resource_type_id = params.resource_type_id
    if (params.category) query.category = params.category
    if (params.only_in_stock !== undefined) query.only_in_stock = String(params.only_in_stock)
    return api.get<ApiList<InventoryRow>>('/inventory', { params: query }).then((r) => r.data)
  },

  // Resumen agregado por bodega y categoría (GET /inventory/summary). No paginado:
  // el backend lo devuelve como { success, data } (ApiItem<InventorySummaryRow[]>).
  summary() {
    return api
      .get<ApiItem<InventorySummaryRow[]>>('/inventory/summary')
      .then((r) => r.data.data)
  },
}
