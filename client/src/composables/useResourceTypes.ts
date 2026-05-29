import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { resourceTypesApi } from '@/api/resourceTypes.api'
import type { ResourceTypeListParams, ResourceTypePayload } from '@/types/inventory.types'

// Catálogo de tipos de recurso. Acepta filtros reactivos (categoría / activos).
export function useResourceTypes(params?: Ref<ResourceTypeListParams>) {
  return useQuery({
    queryKey: ['resource-types', params ?? { all: true }],
    queryFn: () => resourceTypesApi.list(params?.value),
  })
}

// Mutaciones del catálogo. Invalida recursos y también inventario/umbrales/alertas
// (dependen del catálogo).
export function useResourceTypeMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['resource-types'] })
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['alert-thresholds'] })
  }

  const create = useMutation({ mutationFn: resourceTypesApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: Partial<ResourceTypePayload> & { is_active?: boolean }
    }) => resourceTypesApi.update(id, payload),
    onSuccess: invalidate,
  })
  const deactivate = useMutation({ mutationFn: resourceTypesApi.deactivate, onSuccess: invalidate })

  return { create, update, deactivate }
}
