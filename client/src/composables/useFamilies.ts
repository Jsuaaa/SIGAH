import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { familiesApi } from '@/api/families.api'
import type { FamilyListParams, FamilyUpdatePayload } from '@/types/family.types'

// Listado de familias. La key incluye los params reactivos: al cambiar filtros
// o página, vue-query refetch-ea. placeholderData mantiene la página previa
// visible mientras llega la nueva (sin parpadeo).
export function useFamiliesList(params: Ref<FamilyListParams>) {
  return useQuery({
    queryKey: ['families', params],
    queryFn: () => (params.value.q ? familiesApi.search(params.value) : familiesApi.list(params.value)),
    placeholderData: keepPreviousData,
  })
}

// Detalle de una familia (HU-08). Habilitado solo con id válido.
export function useFamily(id: Ref<number>) {
  return useQuery({
    queryKey: ['families', 'detail', id],
    queryFn: () => familiesApi.getById(id.value),
    enabled: () => !!id.value,
  })
}

// Mutaciones de familia. Al crear, invalida el listado para que la nueva familia
// aparezca de inmediato (patrón de useZoneMutations).
export function useFamilyMutations() {
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: familiesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['families'] }),
  })
  // Editar una familia (HU-07). Invalida el prefijo ['families'] para refrescar
  // tanto el listado como el detalle (['families','detail',id]).
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<FamilyUpdatePayload> }) =>
      familiesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['families'] }),
  })
  return { create, update }
}
