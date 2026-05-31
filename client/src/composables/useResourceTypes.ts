import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { resourceTypesApi } from '@/api/resourceTypes.api'
import type { ResourceTypeListParams, ResourceTypePayload } from '@/types/resourceType.types'

// Catálogo completo de tipos de recurso activos (selects de Inventario/Donaciones).
export function useAllResourceTypes() {
  return useQuery({
    queryKey: ['resource-types', 'all'],
    queryFn: resourceTypesApi.listAll,
    staleTime: 1000 * 60 * 10,
  })
}

// Listado paginado/filtrable para la página de Tipos de recurso.
export function useResourceTypes(params: Ref<ResourceTypeListParams>) {
  return useQuery({
    queryKey: ['resource-types', 'list', params],
    queryFn: () => resourceTypesApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Mutaciones de tipo de recurso. Invalida todo el árbol ['resource-types'] para
// refrescar tanto el listado como el catálogo de selects.
export function useResourceTypeMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['resource-types'] })

  const create = useMutation({ mutationFn: resourceTypesApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ResourceTypePayload> }) =>
      resourceTypesApi.update(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: resourceTypesApi.remove, onSuccess: invalidate })

  return { create, update, remove }
}
