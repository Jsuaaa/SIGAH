import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { deliveriesApi } from '@/api/deliveries.api'
import type {
  DeliveryListParams, DeliveryPayload, DeliveryStatus, ExceptionPayload,
} from '@/types/delivery.types'

export function useDeliveriesList(params: Ref<DeliveryListParams>) {
  return useQuery({
    queryKey: ['deliveries', 'list', params],
    queryFn: () => deliveriesApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

export function useDelivery(id: Ref<number>) {
  return useQuery({
    queryKey: ['deliveries', 'detail', id],
    queryFn: () => deliveriesApi.getById(id.value),
    enabled: computed(() => id.value > 0),
  })
}

// Elegibilidad reactiva por familia (HU-23). Solo consulta con family_id válido.
export function useDeliveryEligibility(familyId: Ref<number>) {
  return useQuery({
    queryKey: ['deliveries', 'eligibility', familyId],
    queryFn: () => deliveriesApi.eligibility(familyId.value),
    enabled: computed(() => familyId.value > 0),
    retry: false,
  })
}

export function useNextBatch(count: Ref<number>) {
  return useQuery({
    queryKey: ['prioritization', 'next-batch', count],
    queryFn: () => deliveriesApi.nextBatch(count.value),
    enabled: computed(() => count.value > 0),
  })
}

// Una entrega descuenta inventario, cambia el peso de la bodega y recalcula el
// puntaje de la familia → invalida deliveries/warehouses/inventory/prioritization/families.
export function useDeliveryMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deliveries'] })
    qc.invalidateQueries({ queryKey: ['warehouses'] })
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['prioritization'] })
    qc.invalidateQueries({ queryKey: ['families'] })
  }

  const create = useMutation({
    mutationFn: ({ payload, clientOpId }: { payload: DeliveryPayload; clientOpId?: string }) =>
      deliveriesApi.create(payload, clientOpId),
    onSuccess: invalidate,
  })
  const createException = useMutation({
    mutationFn: (payload: ExceptionPayload) => deliveriesApi.createException(payload),
    onSuccess: invalidate,
  })
  const createBatch = useMutation({
    mutationFn: (count: number) => deliveriesApi.createBatch(count),
    onSuccess: invalidate,
  })
  const updateStatus = useMutation({
    mutationFn: ({ id, status, received_by_document }: { id: number; status: DeliveryStatus; received_by_document?: string }) =>
      deliveriesApi.updateStatus(id, status, received_by_document),
    onSuccess: invalidate,
  })

  return { create, createException, createBatch, updateStatus }
}
