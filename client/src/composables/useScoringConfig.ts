import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { scoringConfigApi } from '@/api/scoringConfig.api'

// Configuración de pesos de priorización (HU-08).
export function useScoringConfig() {
  return useQuery({
    queryKey: ['scoring-config'],
    queryFn: scoringConfigApi.get,
    staleTime: 1000 * 60 * 5,
  })
}

// Mutación de pesos. El backend edita UN peso por petición, así que la página
// guarda cada peso modificado por separado con esta misma mutación.
//
// onSuccess invalida la cache de priorización (HU-08 CA): cualquier puntaje,
// ranking o lote de priorización deja de ser válido al cambiar un peso. Como
// los puntajes se recalculan en el backend, refrescamos:
//   - ['scoring-config'] para reflejar el nuevo valor y updated_at,
//   - ['families'] (la lista y el detalle muestran priority_score y el desglose),
//   - ['prioritization'] y ['ranking'] para cualquier vista de ranking/lotes.
export function useScoringConfigMutations() {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['scoring-config'] })
    qc.invalidateQueries({ queryKey: ['families'] })
    qc.invalidateQueries({ queryKey: ['prioritization'] })
    qc.invalidateQueries({ queryKey: ['ranking'] })
  }

  const update = useMutation({
    mutationFn: scoringConfigApi.update,
    onSuccess: invalidate,
  })

  return { update }
}
