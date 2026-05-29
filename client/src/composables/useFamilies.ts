import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { familiesApi } from '@/api/families.api'
import type { FamilyCreatePayload, FamilyListParams, FamilyUpdatePayload } from '@/types/family.types'

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

// Detalle de una familia (HU-08). Incluye priority_score vivo + desglose.
export function useFamily(id: Ref<number>) {
  return useQuery({
    queryKey: ['families', 'detail', id],
    queryFn: () => familiesApi.getById(id.value),
    enabled: computed(() => id.value > 0),
  })
}

export function useFamilyPersons(id: Ref<number>) {
  return useQuery({
    queryKey: ['families', 'persons', id],
    queryFn: () => familiesApi.listPersons(id.value),
    enabled: computed(() => id.value > 0),
  })
}

export function useFamilyDeliveries(id: Ref<number>) {
  return useQuery({
    queryKey: ['families', 'deliveries', id],
    queryFn: () => familiesApi.listDeliveries(id.value),
    enabled: computed(() => id.value > 0),
  })
}

export function useFamilyEligibility(id: Ref<number>) {
  return useQuery({
    queryKey: ['families', 'eligibility', id],
    queryFn: () => familiesApi.getEligibility(id.value),
    enabled: computed(() => id.value > 0),
  })
}

// Mutaciones de familia. Invalida familias (lista + detalle + sub-recursos) y la
// priorización (el ranking depende del puntaje).
export function useFamilyMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['families'] })
    qc.invalidateQueries({ queryKey: ['prioritization'] })
  }

  const create = useMutation({
    mutationFn: ({ payload, clientOpId }: { payload: FamilyCreatePayload; clientOpId?: string }) =>
      familiesApi.create(payload, clientOpId),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FamilyUpdatePayload }) =>
      familiesApi.update(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: familiesApi.remove, onSuccess: invalidate })

  return { create, update, remove }
}
