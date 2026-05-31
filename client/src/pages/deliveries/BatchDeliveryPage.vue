<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Layers, RotateCcw, Loader2, Users, CheckCircle2, TriangleAlert,
} from '@lucide/vue'
import { deliveriesApi } from '@/api/deliveries.api'
import { useDeliveryMutations } from '@/composables/useDeliveries'
import { deliveryBatchSchema } from '@/schemas/delivery.schema'
import type { DeliveryBatchResult } from '@/types/delivery.types'
import type { Family } from '@/types/family.types'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/form/FormField.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const router = useRouter()
const { batch } = useDeliveryMutations()

// Cantidad de familias a atender en el lote (top N priorizadas elegibles, 1-100).
const count = ref<string | number>('10')
const countError = ref('')

// Previsualización: las top N familias priorizadas elegibles (GET /prioritization/next-batch).
const previewLimit = computed(() => {
  const n = Number(count.value)
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : 10
})
const previewQuery = useQuery({
  queryKey: ['deliveries', 'batch-preview', previewLimit],
  queryFn: () => deliveriesApi.nextBatchPreview(previewLimit.value),
})
const previewRows = computed<Family[]>(() => previewQuery.data.value ?? [])

const columns = [
  { key: 'family_code', label: 'Código' },
  { key: 'head_document', label: 'Documento' },
  { key: 'num_members', label: 'Integrantes', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'right' as const },
]
const asFamily = (r: unknown) => r as Family

// Resultado del lote tras confirmar.
const result = ref<DeliveryBatchResult | null>(null)
const confirmOpen = ref(false)

function openConfirm() {
  countError.value = ''
  const parsed = validate(deliveryBatchSchema, { count: count.value })
  if (!parsed.ok) {
    countError.value = parsed.errors.count ?? 'Indica una cantidad entre 1 y 100.'
    return
  }
  if (previewRows.value.length === 0) {
    toast.error('No hay familias priorizadas elegibles para atender.')
    return
  }
  confirmOpen.value = true
}

async function runBatch() {
  confirmOpen.value = false
  const parsed = validate(deliveryBatchSchema, { count: count.value })
  if (!parsed.ok) {
    countError.value = parsed.errors.count ?? 'Indica una cantidad entre 1 y 100.'
    return
  }
  try {
    const res = await batch.mutateAsync({ count: parsed.data.count })
    result.value = res
    toast.success(`Lote procesado: ${res.created} entregas creadas, ${res.skipped} omitidas.`)
    previewQuery.refetch()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo procesar el lote de entregas.'))
  }
}

const submitting = computed(() => batch.isPending.value)

function reset() {
  result.value = null
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Entrega por lote"
      crumb="Entregas"
      subtitle="Atiende las familias priorizadas elegibles de forma masiva"
    >
      <template #actions>
        <AppButton variant="ghost" @click="router.push({ name: 'deliveries' })">Volver</AppButton>
      </template>
    </PageHeader>

    <div class="mx-auto max-w-3xl space-y-5">
      <!-- Resultado del lote -->
      <div v-if="result" class="space-y-4">
        <div class="rounded-lg border border-success-br bg-success-bg p-5">
          <div class="flex items-start gap-3">
            <CheckCircle2 class="mt-0.5 h-6 w-6 shrink-0 text-success" />
            <div>
              <h3 class="text-lg font-semibold text-neutral-900">Lote procesado</h3>
              <p class="mt-1 text-sm text-neutral-600">
                <strong>{{ result.created }}</strong> entregas creadas ·
                <strong>{{ result.skipped }}</strong> familias omitidas.
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="result.skipped_families.length"
          class="rounded-lg border border-warning-br bg-white p-5"
        >
          <p class="mb-3 flex items-center gap-2 text-sm font-semibold text-warning">
            <TriangleAlert class="h-4 w-4" /> Familias omitidas
          </p>
          <ul class="space-y-1 text-sm">
            <li
              v-for="(s, i) in result.skipped_families"
              :key="i"
              class="flex items-start justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-0"
            >
              <span class="font-mono text-xs text-neutral-700">Familia #{{ s.family_id }}</span>
              <span class="text-right text-neutral-600">{{ s.reason }}</span>
            </li>
          </ul>
        </div>

        <div class="flex justify-end gap-3">
          <AppButton variant="ghost" @click="reset">Procesar otro lote</AppButton>
          <AppButton @click="router.push({ name: 'deliveries' })">Ver entregas</AppButton>
        </div>
      </div>

      <!-- Formulario + previsualización -->
      <template v-else>
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Configuración del lote</h4>
          <FormField
            label="Cantidad de familias a atender"
            required
            :error="countError"
            hint="Entre 1 y 100. Se atienden las de mayor puntaje de prioridad."
          >
            <input v-model="count" type="number" min="1" max="100" class="control max-w-[200px]" />
          </FormField>
          <p class="text-xs text-neutral-500">
            El sistema asigna a cada familia su bodega más cercana con existencias y la ración
            mínima de alimentos. Las familias sin stock disponible se omiten automáticamente.
          </p>
        </div>

        <div class="rounded-lg border border-neutral-200 bg-white">
          <div class="flex items-center justify-between border-b border-neutral-200 p-4">
            <p class="flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <Users class="h-4 w-4" /> Familias priorizadas a atender
            </p>
            <span v-if="previewRows.length" class="text-xs text-neutral-500">
              {{ previewRows.length }} {{ previewRows.length === 1 ? 'familia' : 'familias' }}
            </span>
          </div>

          <div v-if="previewQuery.isLoading.value" class="flex items-center gap-2 p-6 text-sm text-neutral-500">
            <Loader2 class="h-4 w-4 animate-spin" /> Calculando priorización…
          </div>

          <div v-else-if="previewQuery.isError.value" class="p-6 text-center">
            <p class="text-sm text-danger">No se pudo cargar la previsualización.</p>
            <AppButton variant="outline" size="sm" class="mt-3" @click="() => previewQuery.refetch()">
              <RotateCcw /> Reintentar
            </AppButton>
          </div>

          <DataTable
            v-else
            :columns="columns"
            :rows="previewRows"
            row-key="id"
            min-width="640px"
          >
            <template #family_code="{ row }">
              <span class="font-mono text-xs font-semibold text-neutral-900">{{ asFamily(row).family_code }}</span>
            </template>
            <template #priority_score="{ row }">
              <span class="font-mono text-xs font-semibold text-neutral-900">
                {{ Math.round(Number(asFamily(row).priority_score)) }}
              </span>
            </template>
            <template #empty>
              <EmptyState
                title="Sin familias elegibles"
                message="No hay familias priorizadas elegibles para un lote en este momento."
              >
                <template #icon><Users /></template>
              </EmptyState>
            </template>
          </DataTable>
        </div>

        <div class="flex justify-end gap-3">
          <AppButton variant="ghost" @click="router.push({ name: 'deliveries' })">Cancelar</AppButton>
          <AppButton :disabled="submitting || previewRows.length === 0" @click="openConfirm">
            <Layers /> {{ submitting ? 'Procesando…' : 'Procesar lote' }}
          </AppButton>
        </div>
      </template>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      tone="warning"
      title="Confirmar lote de entregas"
      :message="`Se crearán entregas para hasta ${previewLimit} familias priorizadas. Esta acción descuenta inventario.`"
      confirm-label="Procesar lote"
      @confirm="runBatch"
      @close="confirmOpen = false"
    />
  </section>
</template>
