import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { inventoryApi } from '@/api/inventory.api'
import type { AdjustInventoryPayload, SetThresholdPayload, UpsertInventoryPayload } from '@/types/inventory.types'

// Resumen por bodega/categoría. warehouseId opcional (global si no se pasa).
export function useInventorySummary(warehouseId?: Ref<number | undefined>) {
  return useQuery({
    queryKey: ['inventory', 'summary', warehouseId ?? { global: true }],
    queryFn: () => inventoryApi.summary(warehouseId?.value),
  })
}

export function useInventoryAlerts() {
  return useQuery({
    queryKey: ['inventory', 'alerts'],
    queryFn: inventoryApi.alerts,
    staleTime: 1000 * 60,
  })
}

// Upsert (agregar stock) y ajuste manual. Afectan el peso de la bodega → invalida
// bodegas también.
export function useInventoryMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['warehouses'] })
  }

  const upsert = useMutation({
    mutationFn: (payload: UpsertInventoryPayload) => inventoryApi.upsert(payload),
    onSuccess: invalidate,
  })
  const adjust = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdjustInventoryPayload }) =>
      inventoryApi.adjust(id, payload),
    onSuccess: invalidate,
  })

  return { upsert, adjust }
}

export function useAlertThresholds() {
  return useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: inventoryApi.listThresholds,
  })
}

export function useThresholdMutations() {
  const qc = useQueryClient()
  const setThreshold = useMutation({
    mutationFn: (payload: SetThresholdPayload) => inventoryApi.setThreshold(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-thresholds'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
  return { setThreshold }
}
