<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Save, RotateCcw, SlidersHorizontal } from '@lucide/vue'
import { useResourceTypes } from '@/composables/useResourceTypes'
import { useAlertThresholds, useThresholdMutations } from '@/composables/useInventory'
import { RESOURCE_CATEGORY_LABELS } from '@/types/inventory.types'
import type { ResourceType, ResourceTypeListParams } from '@/types/inventory.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const activeParams = ref<ResourceTypeListParams>({ is_active: true })
const { data: resourceTypes, isLoading: loadingRt, isError } = useResourceTypes(activeParams)
const { data: thresholds, isLoading: loadingTh } = useAlertThresholds()
const { setThreshold } = useThresholdMutations()

const loading = computed(() => loadingRt.value || loadingTh.value)
const thresholdMap = computed(
  () => new Map((thresholds.value ?? []).map((t) => [t.resource_type_id, t.min_quantity])),
)
interface Row { id: number; rt: ResourceType; saved: number | null }
const rows = computed<Row[]>(() =>
  (resourceTypes.value ?? []).map((rt) => ({ id: rt.id, rt, saved: thresholdMap.value.get(rt.id) ?? null })),
)
const asRow = (r: unknown) => r as Row

// Valores en edición por recurso (se limpian tras guardar para reflejar lo guardado).
const draft = ref<Record<number, string>>({})
const savingId = ref<number | null>(null)

function inputVal(row: Row) {
  return draft.value[row.rt.id] ?? (row.saved != null ? String(row.saved) : '')
}
function onInput(id: number, v: string) {
  draft.value[id] = v
}
function isDirty(row: Row) {
  const d = draft.value[row.rt.id]
  if (d === undefined || d === '') return false
  const n = Number(d)
  return !Number.isNaN(n) && n >= 0 && n !== (row.saved ?? -1)
}
async function save(row: Row) {
  const d = draft.value[row.rt.id]
  const n = Number(d)
  if (d === '' || d === undefined || Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
    toast.error('Ingresa un entero válido (≥ 0).')
    return
  }
  savingId.value = row.rt.id
  try {
    await setThreshold.mutateAsync({ resource_type_id: row.rt.id, min_quantity: n })
    toast.success(`Umbral de “${row.rt.name}” actualizado`)
    delete draft.value[row.rt.id]
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    savingId.value = null
  }
}

const columns = [
  { key: 'resource', label: 'Recurso' },
  { key: 'unit', label: 'Unidad' },
  { key: 'threshold', label: 'Umbral mínimo' },
  { key: 'actions', label: '', align: 'right' as const },
]
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Umbrales de alerta"
      crumb="Configuración"
      subtitle="Cantidad mínima por recurso antes de generar alerta de stock bajo (HU-16)"
    />

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center text-sm text-danger">
      No se pudieron cargar los umbrales.
    </div>

    <div v-else-if="loading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <DataTable v-else :columns="columns" :rows="rows" row-key="id" min-width="640px">
      <template #resource="{ row }">
        <div>
          <p class="font-medium text-neutral-900">{{ asRow(row).rt.name }}</p>
          <p class="text-xs text-neutral-500">{{ RESOURCE_CATEGORY_LABELS[asRow(row).rt.category] }}</p>
        </div>
      </template>
      <template #unit="{ row }"><span class="text-neutral-600">{{ asRow(row).rt.unit_of_measure }}</span></template>
      <template #threshold="{ row }">
        <input
          type="number"
          min="0"
          step="1"
          class="control max-w-[160px]"
          :value="inputVal(asRow(row))"
          :placeholder="asRow(row).saved == null ? 'Sin umbral' : ''"
          @input="onInput(asRow(row).rt.id, ($event.target as HTMLInputElement).value)"
        />
      </template>
      <template #actions="{ row }">
        <AppButton
          variant="outline"
          size="sm"
          :disabled="!isDirty(asRow(row)) || savingId === asRow(row).rt.id"
          @click="save(asRow(row))"
        >
          <Save /> {{ savingId === asRow(row).rt.id ? 'Guardando…' : 'Guardar' }}
        </AppButton>
      </template>
      <template #empty>
        <EmptyState title="Sin recursos activos" message="Crea tipos de recurso para configurar sus umbrales de alerta.">
          <template #icon><SlidersHorizontal /></template>
        </EmptyState>
      </template>
    </DataTable>

    <p class="flex items-center gap-2 text-xs text-neutral-400">
      <RotateCcw class="h-3.5 w-3.5" /> Los cambios se aplican al guardar cada fila.
    </p>
  </section>
</template>
