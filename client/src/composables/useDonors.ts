import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { donorsApi } from '@/api/donors.api'
import type { DonorListParams, DonorPayload } from '@/types/donor.types'

// Catálogo de donantes activos para selects (formulario de donación).
export function useDonors() {
  return useQuery({
    queryKey: ['donors', 'all'],
    queryFn: donorsApi.listAll,
    staleTime: 1000 * 60 * 5,
  })
}

export function useDonorsList(params: Ref<DonorListParams>) {
  return useQuery({
    queryKey: ['donors', 'list', params],
    queryFn: () => donorsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

export function useDonor(id: Ref<number>) {
  return useQuery({
    queryKey: ['donors', 'detail', id],
    queryFn: () => donorsApi.getById(id.value),
    enabled: computed(() => id.value > 0),
  })
}

export function useDonorDonations(id: Ref<number>) {
  return useQuery({
    queryKey: ['donors', 'donations', id],
    queryFn: () => donorsApi.donations(id.value),
    enabled: computed(() => id.value > 0),
  })
}

export function useDonorMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['donors'] })
    qc.invalidateQueries({ queryKey: ['donations'] })
  }

  const create = useMutation({ mutationFn: donorsApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<DonorPayload> & { is_active?: boolean } }) =>
      donorsApi.update(id, payload),
    onSuccess: invalidate,
  })
  const deactivate = useMutation({ mutationFn: donorsApi.deactivate, onSuccess: invalidate })

  return { create, update, deactivate }
}
