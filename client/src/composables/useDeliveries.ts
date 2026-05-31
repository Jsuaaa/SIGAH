import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { deliveriesApi } from '@/api/deliveries.api'
import type { DeliveryListParams } from '@/types/delivery.types'

// Listado paginado/filtrable de entregas (HU-22/HU-23). La key incluye los params reactivos:
// al cambiar filtros o página, vue-query refetch-ea. placeholderData mantiene la página previa
// visible mientras llega la nueva (sin parpadeo).
export function useDeliveries(params: Ref<DeliveryListParams>) {
  return useQuery({
    queryKey: ['deliveries', 'list', params],
    queryFn: () => deliveriesApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Detalle de una entrega con familia, bodega e items. Habilitado solo con id válido.
export function useDelivery(id: Ref<number>) {
  return useQuery({
    queryKey: ['deliveries', 'detail', id],
    queryFn: () => deliveriesApi.getById(id.value),
    enabled: () => !!id.value,
  })
}

// Elegibilidad de una familia (RN-02). Se consulta al elegir la familia en el formulario.
// La key reactiva permite refetch al cambiar de familia; deshabilitado sin familyId.
export function useDeliveryEligibility(familyId: Ref<number | null>) {
  return useQuery({
    queryKey: ['deliveries', 'eligibility', familyId],
    queryFn: () => deliveriesApi.eligibility(familyId.value as number),
    enabled: () => !!familyId.value,
    // La cobertura cambia poco; evitamos re-consultas agresivas pero refrescamos al re-montar.
    staleTime: 1000 * 30,
  })
}

// Mutaciones de entrega. Una entrega descuenta inventario y cambia el historial de la familia
// (recálculo de prioridad, RN-08), por lo que invalidamos entregas, inventario, bodegas y
// familias para refrescar existencias, ocupación y puntajes.
export function useDeliveryMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deliveries'] })
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['warehouses'] })
    qc.invalidateQueries({ queryKey: ['families'] })
  }

  // Entrega regular (HU-22). Acepta un client_op_id opcional para idempotencia online.
  const create = useMutation({
    mutationFn: ({ payload, clientOpId }: { payload: import('@/types/delivery.types').DeliveryPayload; clientOpId?: string }) =>
      deliveriesApi.create(payload, clientOpId),
    onSuccess: invalidate,
  })

  // Entrega con excepción autorizada (HU-23 CA5, solo COORDINADOR_LOGISTICA).
  const createException = useMutation({
    mutationFn: deliveriesApi.createException,
    onSuccess: invalidate,
  })

  // Transición de estado (PROGRAMADA → EN_CURSO → ENTREGADA).
  const updateStatus = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: import('@/types/delivery.types').DeliveryStatusPayload }) =>
      deliveriesApi.updateStatus(id, payload),
    onSuccess: invalidate,
  })

  // Lote de entregas priorizadas (HU-23).
  const batch = useMutation({
    mutationFn: deliveriesApi.batch,
    onSuccess: invalidate,
  })

  return { create, createException, updateStatus, batch }
}
