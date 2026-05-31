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

// Detalle de un donante (HU-20). `id` es reactivo: la query se rehace al navegar
// entre donantes y se inhabilita mientras el id no sea un número válido.
export function useDonor(id: Ref<number>) {
  return useQuery({
    queryKey: ['donors', 'detail', id],
    queryFn: () => donorsApi.getById(id.value),
    enabled: () => Number.isFinite(id.value) && id.value > 0,
  });
}

// Historial de donaciones de un donante (HU-20), ya ordenado por fecha desc por
// el backend. Comparte la condición de habilitación con useDonor.
export function useDonorDonations(id: Ref<number>) {
  return useQuery({
    queryKey: ['donors', 'detail', id, 'donations'],
    queryFn: () => donorsApi.getDonations(id.value),
    enabled: () => Number.isFinite(id.value) && id.value > 0,
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
