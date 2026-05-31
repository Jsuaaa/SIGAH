import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { Donation, DonationListParams, DonationPayload } from '@/types/donation.types'

export const donationsApi = {
  // GET /donations — listado paginado con filtros (donante, bodega, tipo, rango de
  // fechas). Nombres de query EXACTOS del controller: donor_id, warehouse_id, type,
  // date_from, date_to.
  list(params: DonationListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.donor_id) query.donor_id = params.donor_id
    if (params.warehouse_id) query.warehouse_id = params.warehouse_id
    if (params.type) query.type = params.type
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<Donation>>('/donations', { params: query }).then((r) => r.data)
  },

  // GET /donations/:id — detalle de la donación con donante y items.
  getById(id: number) {
    return api.get<ApiItem<Donation>>(`/donations/${id}`).then((r) => r.data.data)
  },

  // POST /donations — registra la donación (transaccional). Para IN_KIND/MIXED el
  // backend actualiza el inventario de la bodega destino y rechaza con SH422 si se
  // supera la capacidad máxima (RN-03). El código DON lo genera el backend.
  create(payload: DonationPayload) {
    return api.post<ApiItem<Donation>>('/donations', payload).then((r) => r.data.data)
  },
}
