import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { sheltersApi } from '@/api/shelters.api'
import type { ShelterListParams, ShelterPayload } from '@/types/shelter.types'

// Catálogo completo de refugios (selects/joins). Lo consume FamiliesListPage.
export function useShelters() {
  return useQuery({
    queryKey: ['shelters', 'all'],
    queryFn: sheltersApi.listAll,
    staleTime: 1000 * 60 * 10,
  })
}

// Listado paginado/filtrable para la página de Refugios.
export function useSheltersList(params: Ref<ShelterListParams>) {
  return useQuery({
    queryKey: ['shelters', 'list', params],
    queryFn: () => sheltersApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Mutaciones de refugio. Invalida refugios y zonas (el detalle de zona muestra
// sus refugios y conteos).
export function useShelterMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['shelters'] })
    qc.invalidateQueries({ queryKey: ['zones'] })
  }

  const create = useMutation({ mutationFn: sheltersApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ShelterPayload> }) =>
      sheltersApi.update(id, payload),
    onSuccess: invalidate,
  })
  const setOccupancy = useMutation({
    mutationFn: ({ id, value }: { id: number; value: number }) => sheltersApi.setOccupancy(id, value),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: sheltersApi.remove, onSuccess: invalidate })

  return { create, update, setOccupancy, remove }
}
