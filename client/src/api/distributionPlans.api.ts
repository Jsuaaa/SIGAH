import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  CreatePlanPayload,
  DistributionPlan,
  DistributionPlanWithItems,
  PlanListParams,
} from '@/types/distributionPlan.types'

export const distributionPlansApi = {
  list(params: PlanListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.status) query.status = params.status
    if (params.scope) query.scope = params.scope
    return api.get<ApiList<DistributionPlanWithItems>>('/distribution-plans', { params: query }).then((r) => r.data)
  },

  getById(id: number) {
    return api.get<ApiItem<DistributionPlanWithItems>>(`/distribution-plans/${id}`).then((r) => r.data.data)
  },

  create(payload: CreatePlanPayload) {
    return api.post<ApiItem<DistributionPlan>>('/distribution-plans', payload).then((r) => r.data.data)
  },

  execute(id: number) {
    return api.post<ApiItem<DistributionPlan>>(`/distribution-plans/${id}/execute`).then((r) => r.data.data)
  },

  cancel(id: number) {
    return api.put<ApiItem<DistributionPlan>>(`/distribution-plans/${id}/cancel`).then((r) => r.data.data)
  },
}
