import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { personsApi } from '@/api/persons.api'
import type { PersonPayload } from '@/types/person.types'

// Mutaciones de persona. Cada alta/edición/baja recalcula los conteos y el
// puntaje de la familia en el backend (#14, RN-08); por eso invalidamos también
// familias y priorización para que el detalle y el ranking reflejen el cambio.
export function usePersonMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['families'] })
    qc.invalidateQueries({ queryKey: ['prioritization'] })
  }

  const create = useMutation({ mutationFn: personsApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Omit<PersonPayload, 'family_id'> }) =>
      personsApi.update(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: personsApi.remove, onSuccess: invalidate })

  return { create, update, remove }
}

// Búsqueda por documento (HU-06). Reactiva: el page setea `document` al enviar;
// solo dispara con ≥3 caracteres. retry:false para que un 404 (no encontrado)
// se refleje de inmediato como isError.
export function usePersonSearch(document: Ref<string>) {
  return useQuery({
    queryKey: ['persons', 'search', document],
    queryFn: () => personsApi.findByDocument(document.value.trim()),
    enabled: computed(() => document.value.trim().length >= 3),
    retry: false,
  })
}
