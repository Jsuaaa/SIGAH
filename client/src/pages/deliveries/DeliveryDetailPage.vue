<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, RotateCcw, PlayCircle, CheckCircle2, ShieldAlert } from '@lucide/vue'
import { useDelivery, useDeliveryMutations } from '@/composables/useDeliveries'
import { DELIVERY_STATUS_LABELS } from '@/types/delivery.types'
import type { DeliveryDetail, DeliveryStatus } from '@/types/delivery.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const deliveryId = computed(() => Number(route.params.id))
const STATUS_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'] as const

const { data: delivery, isLoading, isError, refetch } = useDelivery(deliveryId)
const { updateStatus } = useDeliveryMutations()

const columns = [
  { key: 'resource_name', label: 'Recurso' },
  { key: 'quantity', label: 'Cantidad', align: 'right' as const },
  { key: 'weight_kg', label: 'Peso', align: 'right' as const },
  { key: 'batch', label: 'Lote' },
]
const asItem = (r: unknown) => r as DeliveryDetail

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

async function setStatus(status: DeliveryStatus, doc?: string) {
  try {
    await updateStatus.mutateAsync({ id: deliveryId.value, status, received_by_document: doc })
    toast.success(`Entrega marcada como ${DELIVERY_STATUS_LABELS[status].toLowerCase()}`)
    deliverModalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// Modal para "marcar entregada" (captura documento de quien recibe).
const deliverModalOpen = ref(false)
const receivedBy = ref('')
function openDeliver() {
  receivedBy.value = delivery.value?.received_by_document ?? ''
  deliverModalOpen.value = true
}
</script>

<template>
  <section class="space-y-5">
    <div v-if="isLoading" class="space-y-4"><SkeletonBlock height="120px" /><SkeletonBlock height="160px" /></div>
    <div v-else-if="isError || !delivery" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la entrega.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <template v-else>
      <PageHeader :title="delivery.delivery_code" crumb="Entregas">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/deliveries')"><ArrowLeft /> Volver</AppButton>
          <RoleGate :roles="[...STATUS_ROLES]">
            <AppButton v-if="delivery.status === 'PROGRAMADA'" :disabled="updateStatus.isPending.value" @click="setStatus('EN_CURSO')">
              <PlayCircle /> Iniciar
            </AppButton>
            <AppButton v-else-if="delivery.status === 'EN_CURSO'" :disabled="updateStatus.isPending.value" @click="openDeliver">
              <CheckCircle2 /> Marcar entregada
            </AppButton>
          </RoleGate>
        </template>
      </PageHeader>

      <div class="rounded-lg border border-neutral-200 bg-white p-5">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <StatusBadge :status="delivery.status" />
          <span v-if="delivery.exception_reason" class="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning">
            <ShieldAlert class="h-3.5 w-3.5" /> Excepción
          </span>
        </div>
        <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt class="text-neutral-500">Familia</dt><dd class="font-medium text-neutral-900">{{ delivery.family?.family_code ?? `#${delivery.family_id}` }}</dd></div>
          <div><dt class="text-neutral-500">Bodega</dt><dd class="font-medium text-neutral-900">{{ delivery.warehouse?.name ?? `#${delivery.source_warehouse_id}` }}</dd></div>
          <div><dt class="text-neutral-500">Fecha</dt><dd class="font-medium text-neutral-900">{{ fmtDateTime(delivery.delivery_date) }}</dd></div>
          <div><dt class="text-neutral-500">Cobertura</dt><dd class="font-medium text-neutral-900">{{ delivery.coverage_days }} días</dd></div>
          <div><dt class="text-neutral-500">Recibido por</dt><dd class="font-medium text-neutral-900">{{ delivery.received_by_document || '—' }}</dd></div>
        </dl>
        <p v-if="delivery.exception_reason" class="mt-3 rounded-md bg-warning-bg p-3 text-sm text-warning">
          <strong>Excepción:</strong> {{ delivery.exception_reason }}
        </p>
        <p v-if="delivery.notes" class="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">{{ delivery.notes }}</p>
      </div>

      <h2 class="text-sm font-semibold text-neutral-700">Ítems entregados</h2>
      <DataTable :columns="columns" :rows="delivery.details ?? []" row-key="id" min-width="560px">
        <template #resource_name="{ row }"><span class="font-medium text-neutral-900">{{ asItem(row).resource_name }}</span></template>
        <template #quantity="{ row }"><span class="font-mono">{{ asItem(row).quantity }}</span></template>
        <template #weight_kg="{ row }"><span class="font-mono text-xs">{{ Math.round(asItem(row).weight_kg).toLocaleString('es-CO') }} kg</span></template>
        <template #batch="{ row }">{{ asItem(row).batch || '—' }}</template>
        <template #empty><p class="py-6 text-center text-sm text-neutral-500">Sin ítems registrados.</p></template>
      </DataTable>

      <div v-if="delivery.delivery_latitude != null && delivery.delivery_longitude != null" class="rounded-lg border border-neutral-200 bg-white p-2">
        <MapPicker :latitude="delivery.delivery_latitude" :longitude="delivery.delivery_longitude" readonly height="220px" />
      </div>
    </template>

    <!-- Modal marcar entregada -->
    <BaseModal :open="deliverModalOpen" title="Marcar como entregada" max-width="max-w-[420px]" @close="deliverModalOpen = false">
      <FormField label="Recibido por (documento)" input-id="dd-rec" hint="Opcional">
        <input id="dd-rec" v-model="receivedBy" class="control" placeholder="Documento de quien recibe" />
      </FormField>
      <template #footer>
        <AppButton variant="ghost" @click="deliverModalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="updateStatus.isPending.value" @click="setStatus('ENTREGADA', receivedBy.trim() || undefined)">
          {{ updateStatus.isPending.value ? 'Guardando…' : 'Confirmar entrega' }}
        </AppButton>
      </template>
    </BaseModal>
  </section>
</template>
