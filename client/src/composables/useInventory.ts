import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { inventoryApi } from '@/api/inventory.api'
import type { InventoryListParams } from '@/types/inventory.types'

// Listado paginado/filtrable de inventario (HU-15 CA1). keepPreviousData evita el
// parpadeo al paginar/cambiar filtros.
export function useInventory(params: Ref<InventoryListParams>) {
  return useQuery({
    queryKey: ['inventory', 'list', params],
    queryFn: () => inventoryApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Resumen agregado por bodega y categoría (HU-15 CA2).
export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: () => inventoryApi.summary(),
    staleTime: 1000 * 60 * 5,
  })
}
