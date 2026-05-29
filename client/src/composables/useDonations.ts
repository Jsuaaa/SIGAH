import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { donationsApi } from '@/api/donations.api'
import type { DonationListParams } from '@/types/donation.types'

export function useDonationsList(params: Ref<DonationListParams>) {
  return useQuery({
    queryKey: ['donations', 'list', params],
    queryFn: () => donationsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Crear donación. Una donación IN_KIND/MIXED actualiza el inventario de la bodega
// destino → invalida también bodegas/inventario; y los totales del donante.
export function useDonationMutations() {
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: donationsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donations'] })
      qc.invalidateQueries({ queryKey: ['donors'] })
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
  return { create }
}
