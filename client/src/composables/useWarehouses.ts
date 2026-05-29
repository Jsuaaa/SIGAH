import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { warehousesApi } from '@/api/warehouses.api'
import type { WarehouseListParams, WarehousePayload } from '@/types/warehouse.types'

// Catálogo completo de bodegas (selects/joins).
export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: warehousesApi.listAll,
    staleTime: 1000 * 60 * 5,
  })
}

export function useWarehousesList(params: Ref<WarehouseListParams>) {
  return useQuery({
    queryKey: ['warehouses', 'list', params],
    queryFn: () => warehousesApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

export function useWarehouse(id: Ref<number>) {
  return useQuery({
    queryKey: ['warehouses', 'detail', id],
    queryFn: () => warehousesApi.getById(id.value),
    enabled: computed(() => id.value > 0),
  })
}

export function useWarehouseInventory(id: Ref<number>) {
  return useQuery({
    queryKey: ['warehouses', 'inventory', id],
    queryFn: () => warehousesApi.inventory(id.value),
    enabled: computed(() => id.value > 0),
  })
}

// Mutaciones de bodega. Invalida bodegas y zonas (el detalle de zona cuenta sus bodegas).
export function useWarehouseMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['warehouses'] })
    qc.invalidateQueries({ queryKey: ['zones'] })
  }

  const create = useMutation({ mutationFn: warehousesApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<WarehousePayload> }) =>
      warehousesApi.update(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: warehousesApi.remove, onSuccess: invalidate })

  return { create, update, remove }
}
