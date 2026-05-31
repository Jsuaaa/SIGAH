import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { healthVectorsApi } from '@/api/healthVectors.api'
import type {
  HealthVectorListParams,
  HealthVectorStatusPayload,
  HealthVectorUpdatePayload,
} from '@/types/healthVector.types'

// Listado paginado/filtrable de vectores sanitarios (HU-25). La key incluye los
// params reactivos; placeholderData evita el parpadeo al paginar/filtrar.
export function useHealthVectors(params: Ref<HealthVectorListParams>) {
  return useQuery({
    queryKey: ['healthVectors', 'list', params],
    queryFn: () => healthVectorsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Detalle de un vector. Habilitado solo con id válido.
export function useHealthVector(id: Ref<number>) {
  return useQuery({
    queryKey: ['healthVectors', 'detail', id],
    queryFn: () => healthVectorsApi.getById(id.value),
    enabled: () => Number.isFinite(id.value) && id.value > 0,
  })
}

// Mutaciones de vector sanitario. Invalida todo el árbol ['healthVectors'] para
// refrescar el listado tras crear, editar, cambiar estado o eliminar.
export function useHealthVectorMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['healthVectors'] })

  const create = useMutation({ mutationFn: healthVectorsApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: HealthVectorUpdatePayload }) =>
      healthVectorsApi.update(id, payload),
    onSuccess: invalidate,
  })
  const setStatus = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: HealthVectorStatusPayload }) =>
      healthVectorsApi.setStatus(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: healthVectorsApi.remove, onSuccess: invalidate })

  return { create, update, setStatus, remove }
}
