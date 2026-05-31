import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { ResourceCategory } from '@/types/resourceType.types'
import type {
  AlertThreshold,
  AlertThresholdPayload,
  StockAlert,
} from '@/types/alert.types'

export const alertsApi = {
  // GET /inventory/alerts — alertas activas de inventario (stock bajo,
  // vencimientos y bodegas sobre el 85%) con su severidad (HU-16 CA1/CA3).
  listAlerts() {
    return api.get<ApiList<StockAlert>>('/inventory/alerts').then((r) => r.data.data)
  },

  // GET /alert-thresholds — umbrales mínimos configurados por recurso (HU-16 CA2),
  // con el recurso embebido. Acepta filtro opcional por categoría.
  listThresholds(category?: ResourceCategory) {
    const params = category ? { category } : undefined
    return api
      .get<ApiList<AlertThreshold>>('/alert-thresholds', { params })
      .then((r) => r.data.data)
  },

  // PUT /alert-thresholds — upsert del umbral de un recurso (HU-16 CA2). El
  // backend devuelve la fila cruda de alert_thresholds (sin el join del recurso).
  upsertThreshold(payload: AlertThresholdPayload) {
    return api
      .put<ApiItem<Omit<AlertThreshold, 'resource'>>>('/alert-thresholds', payload)
      .then((r) => r.data.data)
  },
}
