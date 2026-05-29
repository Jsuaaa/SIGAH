import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  AdjustInventoryPayload,
  AlertThreshold,
  InventoryAlert,
  InventoryListParams,
  InventoryRow,
  InventorySummaryRow,
  SetThresholdPayload,
  UpsertInventoryPayload,
} from '@/types/inventory.types'

export const inventoryApi = {
  list(params: InventoryListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.warehouse_id) query.warehouse_id = params.warehouse_id
    if (params.resource_type_id) query.resource_type_id = params.resource_type_id
    if (params.category) query.category = params.category
    if (params.only_in_stock) query.only_in_stock = 'true'
    return api.get<ApiList<InventoryRow>>('/inventory', { params: query }).then((r) => r.data)
  },

  summary(warehouseId?: number) {
    return api
      .get<ApiItem<InventorySummaryRow[]>>('/inventory/summary', {
        params: warehouseId ? { warehouse_id: warehouseId } : {},
      })
      .then((r) => r.data.data)
  },

  alerts() {
    return api.get<ApiItem<InventoryAlert[]>>('/inventory/alerts').then((r) => r.data.data)
  },

  // Upsert: si el lote existe suma la cantidad, si no lo crea.
  upsert(payload: UpsertInventoryPayload) {
    return api.post<ApiItem<InventoryRow>>('/inventory', payload).then((r) => r.data.data)
  },

  // Ajuste manual con motivo + nota (HU-17). El backend bloquea stock negativo (409).
  adjust(id: number, payload: AdjustInventoryPayload) {
    return api.put<ApiItem<InventoryRow>>(`/inventory/${id}/adjustment`, payload).then((r) => r.data.data)
  },

  listThresholds() {
    return api.get<ApiItem<AlertThreshold[]>>('/alert-thresholds').then((r) => r.data.data)
  },

  // PUT /alert-thresholds = upsert (crea o actualiza por resource_type_id).
  setThreshold(payload: SetThresholdPayload) {
    return api.put<ApiItem<AlertThreshold>>('/alert-thresholds', payload).then((r) => r.data.data)
  },
}
