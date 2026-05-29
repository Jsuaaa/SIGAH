import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { prioritizationApi } from '@/api/prioritization.api'
import type { RankingParams } from '@/types/prioritization.types'

export function useRanking(params: Ref<RankingParams>) {
  return useQuery({
    queryKey: ['prioritization', 'ranking', params],
    queryFn: () => prioritizationApi.ranking(params.value),
    placeholderData: keepPreviousData,
  })
}

// Recalcula y persiste el puntaje de todas las familias. Invalida ranking y
// familias (el detalle muestra el puntaje vivo).
export function useRecalculate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: prioritizationApi.recalculate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prioritization'] })
      qc.invalidateQueries({ queryKey: ['families'] })
    },
  })
}
