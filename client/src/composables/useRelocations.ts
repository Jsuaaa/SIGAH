import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { relocationsApi } from '@/api/relocations.api'
import type { RelocationListParams } from '@/types/relocation.types'

// Listado paginado/filtrable de traslados (HU-24). La key incluye los params
// reactivos; placeholderData evita el parpadeo al paginar/filtrar.
export function useRelocations(params: Ref<RelocationListParams>) {
  return useQuery({
    queryKey: ['relocations', 'list', params],
    queryFn: () => relocationsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Detalle de un traslado. Habilitado solo con id válido.
export function useRelocation(id: Ref<number>) {
  return useQuery({
    queryKey: ['relocations', 'detail', id],
    queryFn: () => relocationsApi.getById(id.value),
    enabled: () => Number.isFinite(id.value) && id.value > 0,
  })
}

// Mutación de traslado (HU-24). Al aplicarlo cambia el refugio de la familia y la
// ocupación de los refugios origen/destino, por eso invalidamos también
// ['shelters'] y ['families'] (RN derivada de capacidad).
export function useRelocationMutations() {
  const qc = useQueryClient()

  const apply = useMutation({
    mutationFn: relocationsApi.apply,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relocations'] })
      qc.invalidateQueries({ queryKey: ['shelters'] })
      qc.invalidateQueries({ queryKey: ['families'] })
    },
  })

  return { apply }
}
