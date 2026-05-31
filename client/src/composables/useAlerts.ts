import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { alertsApi } from '@/api/alerts.api'

// Alertas de stock activas (HU-16 CA1). Comparte la clave ['inventory-alerts']
// con las mutaciones de inventario (useInventory.ts), que ya la invalidan al
// cargar/ajustar existencias.
export function useStockAlerts() {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: alertsApi.listAlerts,
    staleTime: 1000 * 60, // 1 min: las alertas cambian al mover inventario.
  })
}

// Umbrales configurados por recurso (HU-16 CA2).
export function useAlertThresholds() {
  return useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: () => alertsApi.listThresholds(),
    staleTime: 1000 * 60 * 5,
  })
}

// Upsert de umbral (PUT /alert-thresholds, HU-16 CA2). Al guardar invalida los
// umbrales y las alertas activas: cambiar el umbral puede crear o resolver una
// alerta de stock bajo.
export function useAlertMutations() {
  const qc = useQueryClient()
  const upsert = useMutation({
    mutationFn: alertsApi.upsertThreshold,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-thresholds'] })
      qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
    },
  })

  return { upsert }
}
