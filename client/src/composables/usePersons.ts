import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { personsApi } from '@/api/persons.api'
import type { PersonPayload } from '@/types/person.types'

// Integrantes de una familia (HU-05). Habilitado solo con familyId válido.
export function useFamilyPersons(familyId: Ref<number>) {
  return useQuery({
    queryKey: ['persons', 'family', familyId],
    queryFn: () => personsApi.listByFamily(familyId.value),
    enabled: () => !!familyId.value,
  })
}

// Mutaciones de persona. Al mutar cambian los conteos y el puntaje de la familia,
// así que invalida también el listado de familias y el detalle.
export function usePersonMutations(familyId: Ref<number>) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['persons', 'family', familyId] })
    qc.invalidateQueries({ queryKey: ['families'] })
    qc.invalidateQueries({ queryKey: ['families', 'detail', familyId] })
  }

  const create = useMutation({ mutationFn: personsApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PersonPayload> }) =>
      personsApi.update(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: personsApi.remove, onSuccess: invalidate })

  return { create, update, remove }
}
