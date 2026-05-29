import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { distributionPlansApi } from '@/api/distributionPlans.api'
import type { CreatePlanPayload, PlanListParams } from '@/types/distributionPlan.types'

export function usePlansList(params: Ref<PlanListParams>) {
  return useQuery({
    queryKey: ['distribution-plans', 'list', params],
    queryFn: () => distributionPlansApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

export function usePlan(id: Ref<number>) {
  return useQuery({
    queryKey: ['distribution-plans', 'detail', id],
    queryFn: () => distributionPlansApi.getById(id.value),
    enabled: computed(() => id.value > 0),
  })
}

// Ejecutar un plan materializa entregas → invalida planes, entregas, inventario,
// bodegas y priorización.
export function usePlanMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['distribution-plans'] })
    qc.invalidateQueries({ queryKey: ['deliveries'] })
    qc.invalidateQueries({ queryKey: ['warehouses'] })
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['prioritization'] })
  }

  const create = useMutation({
    mutationFn: (payload: CreatePlanPayload) => distributionPlansApi.create(payload),
    onSuccess: invalidate,
  })
  const execute = useMutation({ mutationFn: distributionPlansApi.execute, onSuccess: invalidate })
  const cancel = useMutation({ mutationFn: distributionPlansApi.cancel, onSuccess: invalidate })

  return { create, execute, cancel }
}
