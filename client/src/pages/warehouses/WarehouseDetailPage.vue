<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, MapPin, AlertTriangle, PackageOpen } from '@lucide/vue'
import { useWarehouse, useWarehouseInventory } from '@/composables/useWarehouses'
import { useZones } from '@/composables/useZones'
import { WAREHOUSE_STATUS_LABELS, RESOURCE_CATEGORY_LABELS } from '@/types/warehouse.types'
import type { WarehouseInventoryRow } from '@/types/warehouse.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import MapPicker from '@/components/form/MapPicker.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

const { data: warehouse, isLoading, isError } = useWarehouse(id)
const { data: inventory } = useWarehouseInventory(id)
const { data: zones } = useZones()

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
]
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
          <template #empty>
            <EmptyState title="Sin inventario" message="Esta bodega aún no tiene recursos registrados.">
              <template #icon><PackageOpen /></template>
            </EmptyState>
          </template>
        </DataTable>
      </div>
    </template>
  </section>
</template>
