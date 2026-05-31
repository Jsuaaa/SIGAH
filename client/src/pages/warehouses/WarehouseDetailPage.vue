<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, MapPin, AlertTriangle, PackageOpen, SlidersHorizontal } from '@lucide/vue'
import { useWarehouse, useWarehouseInventory } from '@/composables/useWarehouses'
import { useInventoryMutations } from '@/composables/useInventory'
import { useZones } from '@/composables/useZones'
import { WAREHOUSE_STATUS_LABELS, RESOURCE_CATEGORY_LABELS } from '@/types/warehouse.types'
import type { WarehouseInventoryRow } from '@/types/warehouse.types'
import { INVENTORY_ADJUST_REASON_OPTIONS } from '@/types/inventory.types'
import { inventoryAdjustSchema } from '@/schemas/inventory.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'
import MapPicker from '@/components/form/MapPicker.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

const { data: warehouse, isLoading, isError } = useWarehouse(id)
const { data: inventory } = useWarehouseInventory(id)
const { data: zones } = useZones()
const { adjust } = useInventoryMutations()

const zoneName = computed(() => {
  if (!warehouse.value) return '—'
  return (zones.value ?? []).find((z) => z.id === warehouse.value!.zone_id)?.name ?? '—'
})

const fmtKg = (n: number) => Math.round(n).toLocaleString('es-CO')
// % de uso de capacidad (el backend solo expone occupancy_ratio/is_over_85_percent).
const usagePct = computed(() =>
  warehouse.value && warehouse.value.max_capacity_kg > 0
    ? (warehouse.value.current_weight_kg / warehouse.value.max_capacity_kg) * 100
    : 0,
)
// HU-11 CA2: el backend bloquea el ingreso al 100% (occupancy_ratio >= 1).
const isFull = computed(() => (warehouse.value?.occupancy_ratio ?? 0) >= 1)

const asRow = (r: unknown) => r as WarehouseInventoryRow

const inventoryCols = [
  { key: 'resource', label: 'Recurso' },
  { key: 'category', label: 'Categoría' },
  { key: 'quantity', label: 'Cantidad', align: 'right' as const },
  { key: 'weight', label: 'Peso (kg)', align: 'right' as const, mono: true },
  { key: 'batch', label: 'Lote / vence' },
  { key: 'actions', label: '', align: 'right' as const },
]

// --- HU-17: ajuste de inventario con motivo ---------------------------------
const adjustOpen = ref(false)
const adjusting = ref<WarehouseInventoryRow | null>(null)
const errors = ref<Record<string, string>>({})

// reason se tipa como string (lo que emite SelectField); el valor se valida y se
// estrecha al enum del backend vía inventoryAdjustSchema antes de enviarlo.
const form = reactive({
  new_quantity: '',
  reason: 'CORRECCION' as string,
  reason_note: '',
})

// Cantidad resultante prevista (CA3). Vacío/NaN => null para no previsualizar.
const previewQuantity = computed<number | null>(() => {
  if (form.new_quantity === '') return null
  const n = Number(form.new_quantity)
  return Number.isNaN(n) ? null : n
})

// Bloquea el guardado si la cantidad resultante quedaría negativa (CA3).
const wouldBeNegative = computed(
  () => previewQuantity.value !== null && previewQuantity.value < 0,
)

// El backend recibe un delta (+/-); aquí pedimos la nueva cantidad y derivamos el
// delta. Si no cambia (delta 0) el backend lo rechaza, así que lo avisamos antes.
const noChange = computed(
  () =>
    adjusting.value !== null &&
    previewQuantity.value !== null &&
    previewQuantity.value === adjusting.value.available_quantity,
)

function openAdjust(row: WarehouseInventoryRow) {
  adjusting.value = row
  form.new_quantity = String(row.available_quantity)
  form.reason = 'CORRECCION'
  form.reason_note = ''
  errors.value = {}
  adjustOpen.value = true
}

async function submitAdjust() {
  if (!adjusting.value) return

  const res = validate(inventoryAdjustSchema, { ...form })
  errors.value = res.ok ? {} : { ...res.errors }
  if (!res.ok) return

  // Guardarraíl de UI (CA3): el backend también rechaza con SH422.
  if (wouldBeNegative.value) {
    errors.value = { new_quantity: 'La cantidad no puede ser negativa' }
    return
  }
  const delta = res.data.new_quantity - adjusting.value.available_quantity
  if (delta === 0) {
    errors.value = { new_quantity: 'La nueva cantidad debe ser distinta de la actual' }
    return
  }

  try {
    await adjust.mutateAsync({
      id: adjusting.value.id,
      payload: { delta, reason: res.data.reason, reason_note: res.data.reason_note },
    })
    toast.success('Inventario ajustado')
    adjustOpen.value = false
  } catch (e) {
    // SH422: stock negativo o capacidad superada (RN-03). Mostramos el mensaje real.
    if (apiErrorStatus(e) === 422) errors.value = { _form: apiErrorMessage(e) }
    toast.error(apiErrorMessage(e))
  }
}
</script>

<template>
  <section class="space-y-5">
    <!-- Carga / error -->
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="40px" width="280px" />
      <SkeletonBlock height="180px" rounded="12px" />
    </div>
    <div v-else-if="isError || !warehouse" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la bodega.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="router.push('/warehouses')">
        <ArrowLeft /> Volver a bodegas
      </AppButton>
    </div>

    <template v-else>
      <PageHeader :title="warehouse.name" crumb="Logística" :subtitle="warehouse.address">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/warehouses')"><ArrowLeft /> Volver</AppButton>
        </template>
      </PageHeader>

      <!-- HU-11 CA2: bodega al 100% (el backend bloquea el ingreso de recursos) -->
      <div
        v-if="isFull"
        class="flex items-start gap-3 rounded-lg border border-danger-br bg-danger-bg p-4"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div class="text-sm">
          <p class="font-semibold text-danger">Bodega llena (100% de capacidad)</p>
          <p class="mt-0.5 text-neutral-600">
            El sistema bloquea el ingreso de nuevos recursos hasta liberar espacio.
          </p>
        </div>
      </div>
      <!-- HU-11 CA3: bodega al/por encima del 85% (RN-03) -->
      <div
        v-else-if="warehouse.is_over_85_percent"
        class="flex items-start gap-3 rounded-lg border border-warning-br bg-warning-bg p-4"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div class="text-sm">
          <p class="font-semibold text-warning">Capacidad al {{ Math.round(usagePct) }}%</p>
          <p class="mt-0.5 text-neutral-600">
            La bodega superó el 85% de su capacidad (RN-03).
          </p>
        </div>
      </div>

      <!-- Resumen + mini-mapa -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-neutral-500">Estado</span>
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                warehouse.status === 'ACTIVE'
                  ? 'text-success bg-success-bg border-success-br'
                  : 'text-neutral-500 bg-neutral-100 border-neutral-200',
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ WAREHOUSE_STATUS_LABELS[warehouse.status] }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-neutral-500">Zona</span>
            <span class="text-sm text-neutral-800">{{ zoneName }}</span>
          </div>
          <div>
            <p class="text-sm text-neutral-500">Ocupación</p>
            <p class="text-2xl font-semibold text-neutral-900">
              {{ fmtKg(warehouse.current_weight_kg) }}
              <span class="text-base font-normal text-neutral-400">/ {{ fmtKg(warehouse.max_capacity_kg) }} kg</span>
            </p>
          </div>
          <!-- Capacidad: verde <85 · ámbar 85-99 · rojo 100% (umbrales 85/100). -->
          <ProgressBar :value="usagePct" label="Uso de capacidad" :ok="16" :warn="1" invert />
          <p class="flex items-center gap-1.5 font-mono text-xs text-neutral-400">
            <MapPin class="h-3.5 w-3.5" /> {{ warehouse.latitude.toFixed(5) }}, {{ warehouse.longitude.toFixed(5) }}
          </p>
        </div>
        <div class="lg:col-span-2">
          <MapPicker :latitude="warehouse.latitude" :longitude="warehouse.longitude" readonly height="240px" />
        </div>
      </div>

      <!-- Inventario (solo lectura; el ajuste es HU-17) -->
      <div>
        <h2 class="mb-3 text-base font-semibold text-neutral-900">Inventario</h2>
        <DataTable :columns="inventoryCols" :rows="inventory ?? []" row-key="id" min-width="720px">
          <template #resource="{ row }">
            <span class="font-medium text-neutral-900">{{ asRow(row).resource.name }}</span>
          </template>
          <template #category="{ row }">
            {{ RESOURCE_CATEGORY_LABELS[asRow(row).resource.category] ?? asRow(row).resource.category }}
          </template>
          <template #quantity="{ row }">
            {{ Number(asRow(row).available_quantity).toLocaleString('es-CO') }}
            <span class="text-xs text-neutral-400">{{ asRow(row).resource.unit_of_measure }}</span>
          </template>
          <template #weight="{ row }">{{ fmtKg(asRow(row).total_weight_kg) }}</template>
          <template #batch="{ row }">
            <div v-if="asRow(row).batch || asRow(row).expiration_date" class="text-xs">
              <p v-if="asRow(row).batch" class="font-mono text-neutral-700">{{ asRow(row).batch }}</p>
              <p
                v-if="asRow(row).expiration_date"
                :class="asRow(row).is_expired ? 'font-semibold text-danger' : 'text-neutral-500'"
              >
                {{ asRow(row).is_expired ? 'Vencido el ' : 'Vence ' }}{{ asRow(row).expiration_date }}
              </p>
            </div>
            <span v-else class="text-neutral-400">—</span>
          </template>
          <!-- HU-17: ajuste por fila (solo ADMIN / COORDINADOR_LOGISTICA) -->
          <template #actions="{ row }">
            <RoleGate :roles="['ADMIN', 'COORDINADOR_LOGISTICA']">
              <div class="flex justify-end">
                <AppButton variant="ghost" size="sm" @click="openAdjust(asRow(row))">
                  <SlidersHorizontal /> Ajustar
                </AppButton>
              </div>
            </RoleGate>
          </template>
          <template #empty>
            <EmptyState title="Sin inventario" message="Esta bodega aún no tiene recursos registrados.">
              <template #icon><PackageOpen /></template>
            </EmptyState>
          </template>
        </DataTable>
      </div>
    </template>

    <!-- HU-17: modal de ajuste de inventario con motivo -->
    <BaseModal
      :open="adjustOpen"
      title="Ajustar inventario"
      max-width="max-w-[520px]"
      @close="adjustOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitAdjust">
        <p v-if="adjusting" class="text-sm text-neutral-500">
          <span class="font-semibold text-neutral-800">{{ adjusting.resource.name }}</span>
          · Cantidad actual:
          {{ adjusting.available_quantity.toLocaleString('es-CO') }}
          {{ adjusting.resource.unit_of_measure }}
        </p>

        <SelectField
          v-model="form.reason"
          label="Motivo"
          required
          :options="INVENTORY_ADJUST_REASON_OPTIONS"
          :error="errors.reason"
          input-id="adjust-reason"
        />

        <FormField
          label="Nota del motivo"
          required
          :error="errors.reason_note"
          hint="Explica brevemente el ajuste (entre 3 y 500 caracteres)."
          input-id="adjust-note"
        >
          <textarea
            id="adjust-note"
            v-model="form.reason_note"
            class="control"
            rows="3"
            placeholder="Describe el motivo del ajuste"
          ></textarea>
        </FormField>

        <FormField
          label="Nueva cantidad"
          required
          :error="errors.new_quantity"
          input-id="adjust-quantity"
        >
          <input
            id="adjust-quantity"
            v-model="form.new_quantity"
            type="number"
            min="0"
            step="1"
            class="control"
          />
        </FormField>

        <!-- CA3: stock resultante previsto -->
        <p
          v-if="previewQuantity !== null"
          :class="['text-sm', wouldBeNegative ? 'text-danger' : 'text-neutral-600']"
        >
          Stock resultante previsto:
          <span class="font-semibold">
            {{ previewQuantity.toLocaleString('es-CO') }} {{ adjusting?.resource.unit_of_measure }}
          </span>
          <span v-if="wouldBeNegative"> — no puede ser negativo</span>
        </p>
        <p v-else-if="noChange" class="text-sm text-warning">
          La nueva cantidad es igual a la actual; cámbiala para registrar un ajuste.
        </p>

        <p v-if="errors._form" class="flex items-center gap-1.5 text-sm text-danger">
          {{ errors._form }}
        </p>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="adjustOpen = false">Cancelar</AppButton>
        <AppButton
          :disabled="adjust.isPending.value || wouldBeNegative || noChange"
          @click="submitAdjust"
        >
          {{ adjust.isPending.value ? 'Guardando…' : 'Guardar ajuste' }}
        </AppButton>
      </template>
    </BaseModal>
  </section>
</template>
