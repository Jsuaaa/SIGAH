import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { relocationsApi } from '@/api/relocations.api'
import type { RelocationListParams } from '@/types/relocation.types'

export function useRelocationsList(params: Ref<RelocationListParams>) {
  return useQuery({
    queryKey: ['relocations', 'list', params],
    queryFn: () => relocationsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Un traslado cambia el refugio de la familia y la ocupación de los refugios.
export function useRelocationMutations() {
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: relocationsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relocations'] })
      qc.invalidateQueries({ queryKey: ['families'] })
      qc.invalidateQueries({ queryKey: ['shelters'] })
    },
  })
  return { create }
}
