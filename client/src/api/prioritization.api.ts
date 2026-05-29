import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { RankingParams, RankingRow } from '@/types/prioritization.types'

export const prioritizationApi = {
  ranking(params: RankingParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.zone_id) query.zone_id = params.zone_id
    if (params.status) query.status = params.status
    return api.get<ApiList<RankingRow>>('/prioritization/ranking', { params: query }).then((r) => r.data)
  },

  // POST /prioritization/recalculate (ADMIN/COORD) → { recalculated: N }.
  recalculate() {
    return api
      .post<ApiItem<{ recalculated: number }>>('/prioritization/recalculate')
      .then((r) => r.data.data)
  },
}
