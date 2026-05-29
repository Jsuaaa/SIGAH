import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { Donor, DonorListParams, DonorPayload } from '@/types/donor.types'
import type { DonationEnriched } from '@/types/donation.types'

export const donorsApi = {
  // Catálogo completo para selects (formulario de donación).
  listAll() {
    return api
      .get<ApiList<Donor>>('/donors', { params: { page: 1, limit: 200, is_active: true } })
      .then((r) => r.data.data)
  },

  list(params: DonorListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.type) query.type = params.type
    if (params.search) query.search = params.search
    if (params.is_active !== undefined) query.is_active = String(params.is_active)
    return api.get<ApiList<Donor>>('/donors', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<Donor>>(`/donors/${id}`).then((r) => r.data.data)
  },

  donations(id: number) {
    return api.get<ApiItem<DonationEnriched[]>>(`/donors/${id}/donations`).then((r) => r.data.data)
  },

  create(payload: DonorPayload) {
    return api.post<ApiItem<Donor>>('/donors', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<DonorPayload> & { is_active?: boolean }) {
    return api.put<ApiItem<Donor>>(`/donors/${id}`, payload).then((r) => r.data.data)
  },

  // DELETE = soft delete (devuelve el donante actualizado, no 204).
  deactivate(id: number) {
    return api.delete<ApiItem<Donor>>(`/donors/${id}`).then((r) => r.data.data)
  },
}
