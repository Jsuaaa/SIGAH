import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { distributionPlansApi } from '@/api/distributionPlans.api'
import type { DistributionPlanListParams } from '@/types/distributionPlan.types'

// Listado paginado/filtrable de planes de distribución (HU-21). placeholderData
// mantiene la página previa visible mientras llega la nueva (sin parpadeo).
export function useDistributionPlans(params: Ref<DistributionPlanListParams>) {
  return useQuery({
    queryKey: ['distribution-plans', 'list', params],
    queryFn: () => distributionPlansApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Detalle de un plan con sus items. Habilitado solo con id válido.
export function useDistributionPlan(id: Ref<number>) {
  return useQuery({
    queryKey: ['distribution-plans', 'detail', id],
    queryFn: () => distributionPlansApi.getById(id.value),
    enabled: () => !!id.value,
  })
}

// Mutaciones de plan de distribución.
//  - create: genera el plan (no afecta inventario aún) → invalida la lista de planes.
//  - execute: materializa las entregas pendientes, por lo que afecta inventario,
//    entregas y familias (atendidas); invalidamos esos prefijos además de los planes.
//  - cancel: cambia el estado del plan → invalida la lista y el detalle.
export function useDistributionPlanMutations() {
  const qc = useQueryClient()
  const invalidatePlans = () => qc.invalidateQueries({ queryKey: ['distribution-plans'] })

  const create = useMutation({
    mutationFn: distributionPlansApi.create,
    onSuccess: invalidatePlans,
  })

  const execute = useMutation({
    mutationFn: (id: number) => distributionPlansApi.execute(id),
    onSuccess: () => {
      invalidatePlans()
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['families'] })
    },
  })

  const cancel = useMutation({
    mutationFn: (id: number) => distributionPlansApi.cancel(id),
    onSuccess: invalidatePlans,
  })

  return { create, execute, cancel }
}
