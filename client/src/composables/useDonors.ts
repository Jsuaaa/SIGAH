import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { donorsApi } from '@/api/donors.api';
import type { DonorListParams, DonorPayload } from '@/types/donor.types';

// Catálogo completo de donantes activos (selects de Donaciones — HU-19).
export function useAllDonors() {
  return useQuery({
    queryKey: ['donors', 'all'],
    queryFn: donorsApi.listAll,
    staleTime: 1000 * 60 * 10,
  });
}

// Listado paginado/filtrable para la página de Donantes.
export function useDonors(params: Ref<DonorListParams>) {
  return useQuery({
    queryKey: ['donors', 'list', params],
    queryFn: () => donorsApi.list(params.value),
    placeholderData: keepPreviousData,
  });
}

// Mutaciones de donante. Invalida todo el árbol ['donors'] para refrescar tanto
// el listado como el catálogo de selects.
export function useDonorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['donors'] });

  const create = useMutation({ mutationFn: donorsApi.create, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<DonorPayload> }) =>
      donorsApi.update(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: donorsApi.remove, onSuccess: invalidate });

  return { create, update, remove };
}
