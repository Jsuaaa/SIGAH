<script setup lang="ts">
import { computed, ref } from 'vue'
import { Boxes, Package, Warehouse as WarehouseIcon, Scale, RotateCcw } from '@lucide/vue'
import { useInventorySummary } from '@/composables/useInventory'
import { useWarehouses } from '@/composables/useWarehouses'
import { RESOURCE_CATEGORY_LABELS } from '@/types/inventory.types'
import type { ResourceCategory } from '@/types/inventory.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import SelectField from '@/components/form/SelectField.vue'

const warehouseFilter = ref('')
const warehouseId = computed(() => (warehouseFilter.value ? Number(warehouseFilter.value) : undefined))

const { data, isLoading, isError, refetch } = useInventorySummary(warehouseId)
const { data: warehouses } = useWarehouses()

const warehouseOptions = computed(() => [
  { value: '', label: 'Todas las bodegas' },
  ...(warehouses.value ?? []).map((w) => ({ value: String(w.id), label: w.name })),
])

// Solo filas-hoja (categoría no nula) para evitar doble conteo si el backend
// incluyera subtotales con category=null.
const leaves = computed(() => (data.value ?? []).filter((r) => r.category != null))

const totalWeight = computed(() => leaves.value.reduce((a, r) => a + r.total_weight_kg, 0))
const totalItems = computed(() => leaves.value.reduce((a, r) => a + Number(r.total_quantity), 0))

const byCategory = computed(() => {
  const m = new Map<ResourceCategory, { weight: number; qty: number }>()
  for (const r of leaves.value) {
    const cat = r.category as ResourceCategory
    const cur = m.get(cat) ?? { weight: 0, qty: 0 }
    cur.weight += r.total_weight_kg
    cur.qty += Number(r.total_quantity)
    m.set(cat, cur)
  }
  return [...m.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.weight - a.weight)
})
const maxCatWeight = computed(() => Math.max(1, ...byCategory.value.map((c) => c.weight)))

const byWarehouse = computed(() => {
  const m = new Map<number, { name: string; weight: number; qty: number }>()
  for (const r of leaves.value) {
    const cur = m.get(r.warehouse_id) ?? { name: r.warehouse_name, weight: 0, qty: 0 }
    cur.weight += r.total_weight_kg
    cur.qty += Number(r.total_quantity)
    m.set(r.warehouse_id, cur)
  }
  return [...m.values()].sort((a, b) => b.weight - a.weight)
})

const kg = (n: number) => `${Math.round(n).toLocaleString('es-CO')} kg`
const num = (n: number) => n.toLocaleString('es-CO')
const isEmpty = computed(() => !isLoading.value && leaves.value.length === 0)
</script>

<template>
  <section class="space-y-5">
    <PageHeader title="Resumen de inventario" crumb="Logística" subtitle="Existencias agregadas por categoría y bodega">
      <template #actions>
        <div class="w-56"><SelectField v-model="warehouseFilter" :options="warehouseOptions" /></div>
      </template>
    </PageHeader>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el resumen.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SkeletonBlock v-for="n in 4" :key="n" height="120px" />
    </div>

    <div v-else-if="isEmpty" class="rounded-lg border border-neutral-200 bg-white">
      <EmptyState title="Sin existencias" message="No hay inventario registrado para mostrar.">
        <template #icon><Boxes /></template>
      </EmptyState>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Peso almacenado" :value="kg(totalWeight)"><template #icon><Scale /></template></KpiCard>
        <KpiCard label="Unidades en stock" :value="num(totalItems)" tone="accent"><template #icon><Package /></template></KpiCard>
        <KpiCard label="Categorías con stock" :value="byCategory.length"><template #icon><Boxes /></template></KpiCard>
        <KpiCard label="Bodegas con stock" :value="byWarehouse.length" tone="accent"><template #icon><WarehouseIcon /></template></KpiCard>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Por categoría -->
        <div class="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-neutral-700">Peso por categoría</h2>
          <div class="space-y-4">
            <div v-for="c in byCategory" :key="c.category">
              <div class="mb-1.5 flex justify-between text-sm">
                <span class="font-medium text-neutral-700">{{ RESOURCE_CATEGORY_LABELS[c.category] }}</span>
                <span class="font-mono text-neutral-900">{{ kg(c.weight) }} · {{ num(c.qty) }} u.</span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-neutral-200">
                <div class="h-full rounded-full bg-primary-600" :style="{ width: (c.weight / maxCatWeight) * 100 + '%' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Por bodega -->
        <div class="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-neutral-700">Peso por bodega</h2>
          <ul class="divide-y divide-neutral-100">
            <li v-for="w in byWarehouse" :key="w.name" class="flex items-center justify-between py-2.5">
              <span class="text-sm text-neutral-700">{{ w.name }}</span>
              <span class="font-mono text-sm text-neutral-900">{{ kg(w.weight) }} · {{ num(w.qty) }} u.</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
