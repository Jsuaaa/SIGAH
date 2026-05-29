import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { scoringConfigApi } from '@/api/scoringConfig.api'
import type { ScoringConfigKey } from '@/types/prioritization.types'

export function useScoringConfig() {
  return useQuery({
    queryKey: ['scoring-config'],
    queryFn: scoringConfigApi.list,
  })
}

// Cada peso se guarda con un PUT { key, value }. Invalida la config y la
// priorización (los pesos afectan futuros recálculos del puntaje).
export function useScoringConfigMutations() {
  const qc = useQueryClient()
  const set = useMutation({
    mutationFn: ({ key, value }: { key: ScoringConfigKey; value: number }) =>
      scoringConfigApi.set(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scoring-config'] })
      qc.invalidateQueries({ queryKey: ['prioritization'] })
    },
  })
  return { set }
}
