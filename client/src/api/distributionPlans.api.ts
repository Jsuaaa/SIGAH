import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  DistributionPlan,
  DistributionPlanListParams,
  DistributionPlanPayload,
  DistributionPlanWithItems,
} from '@/types/distributionPlan.types'

export const distributionPlansApi = {
  // GET /distribution-plans — listado paginado con filtros opcionales por estado,
  // alcance y creador. Nombres de query EXACTOS del controller: status, scope,
  // created_by. Cada fila incluye los contadores items_* (fn_distribution_plans_list).
  list(params: DistributionPlanListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.status) query.status = params.status
    if (params.scope) query.scope = params.scope
    if (params.created_by) query.created_by = params.created_by
    return api.get<ApiList<DistributionPlan>>('/distribution-plans', { params: query }).then((r) => r.data)
  },

  // GET /distribution-plans/:id — detalle del plan con sus items embebidos.
  getById(id: number) {
    return api
      .get<ApiItem<DistributionPlanWithItems>>(`/distribution-plans/${id}`)
      .then((r) => r.data.data)
  },

  // POST /distribution-plans — genera el plan priorizado. El backend selecciona las
  // familias elegibles según el alcance, las ordena por priority_score y crea un item
  // por familia (PENDIENTE o SIN_ATENDER según stock/elegibilidad). Devuelve la fila
  // del plan ya creado (status PROGRAMADA). El código PLN lo genera el backend.
  create(payload: DistributionPlanPayload) {
    return api.post<ApiItem<DistributionPlan>>('/distribution-plans', payload).then((r) => r.data.data)
  },

  // POST /distribution-plans/:id/execute — pasa el plan a EN_EJECUCION y materializa
  // las entregas de sus items pendientes (afecta inventario, entregas y familias).
  execute(id: number) {
    return api
      .post<ApiItem<DistributionPlan>>(`/distribution-plans/${id}/execute`)
      .then((r) => r.data.data)
  },

  // PUT /distribution-plans/:id/cancel — cancela el plan (estado CANCELADA).
  cancel(id: number) {
    return api
      .put<ApiItem<DistributionPlan>>(`/distribution-plans/${id}/cancel`)
      .then((r) => r.data.data)
  },
}
