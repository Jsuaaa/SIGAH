import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  Donation, DonationEnriched, DonationListParams, DonationPayload,
} from '@/types/donation.types'

export const donationsApi = {
  list(params: DonationListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.donor_id) query.donor_id = params.donor_id
    if (params.type) query.type = params.type
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<DonationEnriched>>('/donations', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<DonationEnriched>>(`/donations/${id}`).then((r) => r.data.data)
  },

  create(payload: DonationPayload) {
    return api.post<ApiItem<Donation>>('/donations', payload).then((r) => r.data.data)
  },
}
