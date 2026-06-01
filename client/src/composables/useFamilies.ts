import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { familiesApi } from '@/api/families.api'
import type { FamilyListParams } from '@/types/family.types'

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
