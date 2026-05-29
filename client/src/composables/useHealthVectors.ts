import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { healthVectorsApi } from '@/api/healthVectors.api'
import type { HealthVectorListParams, HealthVectorPayload, HealthVectorStatus } from '@/types/healthVector.types'

export function useHealthVectorsList(params: Ref<HealthVectorListParams>) {
  return useQuery({
    queryKey: ['health-vectors', 'list', params],
    queryFn: () => healthVectorsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

export function useHealthVectorMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['health-vectors'] })
    qc.invalidateQueries({ queryKey: ['map'] })
  }

  const create = useMutation({ mutationFn: healthVectorsApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<HealthVectorPayload> & { actions_taken?: string | null } }) =>
      healthVectorsApi.update(id, payload),
    onSuccess: invalidate,
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status, actions_taken }: { id: number; status: HealthVectorStatus; actions_taken?: string | null }) =>
      healthVectorsApi.setStatus(id, status, actions_taken),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: healthVectorsApi.remove, onSuccess: invalidate })

  return { create, update, setStatus, remove }
}
