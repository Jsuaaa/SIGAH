<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, Layers, CheckCircle2, XCircle, RotateCcw } from '@lucide/vue'
import { useNextBatch, useDeliveryMutations } from '@/composables/useDeliveries'
import type { NextBatchRow } from '@/types/delivery.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FormField from '@/components/form/FormField.vue'

const router = useRouter()
const countInput = ref('10')
const count = computed(() => {
  const n = Number(countInput.value)
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 0
})

const { data, isLoading, isFetching, isError, refetch } = useNextBatch(count)
const { createBatch } = useDeliveryMutations()

const rows = computed(() => data.value ?? [])
const eligibleCount = computed(() => rows.value.filter((r) => r.eligibility.is_eligible).length)
const asRow = (r: unknown) => r as NextBatchRow

const columns = [
  { key: 'family_code', label: 'Código', mono: true },
  { key: 'zone_name', label: 'Zona' },
  { key: 'num_members', label: 'Miembros', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'right' as const },
  { key: 'eligibility', label: 'Elegible', align: 'center' as const },
]

async function execute() {
  if (!count.value) {
    toast.error('Ingresa una cantidad entre 1 y 100.')
    return
  }
  try {
    const res = await createBatch.mutateAsync(count.value)
    toast.success(`${res.created} entrega(s) creada(s)`)
    router.push('/deliveries')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo crear el lote.'))
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader title="Entrega por lote" crumb="Ayudas" subtitle="Crea entregas para las familias más prioritarias (HU-21/22)">
      <template #actions>
        <AppButton variant="outline" @click="router.push('/deliveries')"><ArrowLeft /> Volver</AppButton>
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div class="w-40">
        <FormField label="Cantidad (N)" input-id="b-count" hint="1 a 100">
          <input id="b-count" v-model="countInput" type="number" min="1" max="100" class="control" />
        </FormField>
      </div>
      <AppButton :disabled="createBatch.isPending.value || !count" @click="execute">
        <Layers /> {{ createBatch.isPending.value ? 'Creando…' : `Crear lote (${eligibleCount} elegibles)` }}
      </AppButton>
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la vista previa.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="40px" />
    </div>
    <div v-else :class="{ 'opacity-60 transition-opacity': isFetching }">
      <p class="mb-2 text-sm text-neutral-500">Vista previa de las {{ rows.length }} familias mejor priorizadas:</p>
      <DataTable :columns="columns" :rows="rows" row-key="id" min-width="640px">
        <template #family_code="{ row }"><span class="font-semibold text-neutral-900">{{ asRow(row).family_code }}</span></template>
        <template #priority_score="{ row }"><span class="font-semibold">{{ Math.round(asRow(row).priority_score) }}</span></template>
        <template #eligibility="{ row }">
          <span v-if="asRow(row).eligibility.is_eligible" class="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <CheckCircle2 class="h-4 w-4" /> Sí
          </span>
          <span v-else class="inline-flex items-center gap-1 text-xs font-semibold text-warning" :title="asRow(row).eligibility.reason">
            <XCircle class="h-4 w-4" /> No
          </span>
        </template>
        <template #empty>
          <EmptyState title="Sin familias" message="No hay familias priorizadas para generar un lote.">
            <template #icon><Layers /></template>
          </EmptyState>
        </template>
      </DataTable>
    </div>
  </section>
</template>
