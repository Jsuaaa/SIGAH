import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { donationsApi } from '@/api/donations.api'
import type { DonationListParams } from '@/types/donation.types'

// Listado paginado/filtrable de donaciones (HU-19/HU-20).
export function useDonations(params: Ref<DonationListParams>) {
  return useQuery({
    queryKey: ['donations', 'list', params],
    queryFn: () => donationsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Detalle de una donación con sus items.
export function useDonation(id: Ref<number>) {
  return useQuery({
    queryKey: ['donations', 'detail', id],
    queryFn: () => donationsApi.getById(id.value),
    enabled: () => !!id.value,
  })
}

// Mutación de creación de donación. Una donación en especie afecta el inventario y
// el peso de la bodega destino, por lo que invalidamos donaciones, inventario y
// bodegas para refrescar existencias y ocupación.
export function useDonationMutations() {
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: donationsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donations'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })

  return { create }
}
