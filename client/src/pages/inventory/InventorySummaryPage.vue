<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw, SearchX, Boxes, Scale, PackageX, AlertTriangle } from '@lucide/vue'
import { useInventory, useInventorySummary } from '@/composables/useInventory'
import { useAllWarehouses } from '@/composables/useWarehouses'
import {
  RESOURCE_CATEGORY_OPTIONS,
  RESOURCE_CATEGORY_LABELS,
  RESOURCE_CATEGORY_BADGE,
} from '@/types/resourceType.types'
import type { ResourceCategory } from '@/types/resourceType.types'
import type { InventoryListParams, InventoryRow } from '@/types/inventory.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SelectField from '@/components/form/SelectField.vue'

const PAGE_SIZE = 20
// Umbral (días) para marcar una expiración como "próxima a vencer" (HU-15 CA3).
const EXPIRATION_WARNING_DAYS = 30

const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

// --- Resumen agregado por categoría (CA2) ------------------------------------
const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } =
  useInventorySummary()

// El backend agrupa por (bodega, categoría). Para el resumen general agregamos por
// categoría sumando todas las bodegas: total de stock y peso por categoría.
interface CategoryTotal {
  category: ResourceCategory
  total_quantity: number
  total_weight_kg: number
}
const categoryTotals = computed<CategoryTotal[]>(() => {
  const acc = new Map<ResourceCategory, CategoryTotal>()
  for (const r of summary.value ?? []) {
    const cur = acc.get(r.category) ?? {
      category: r.category,
      total_quantity: 0,
      total_weight_kg: 0,
    }
    cur.total_quantity += Number(r.total_quantity)
    cur.total_weight_kg += Number(r.total_weight_kg)
    acc.set(r.category, cur)
  }
  // Orden estable según el catálogo de categorías.
  return RESOURCE_CATEGORY_OPTIONS.map((o) => acc.get(o.value)).filter(
    (x): x is CategoryTotal => !!x,
  )
})

const totalQuantity = computed(() =>
  categoryTotals.value.reduce((s, c) => s + c.total_quantity, 0),
)
const totalWeight = computed(() =>
  categoryTotals.value.reduce((s, c) => s + c.total_weight_kg, 0),
)
// Cantidad máxima por categoría: base para normalizar las barras comparativas.
const maxCategoryQuantity = computed(() =>
  categoryTotals.value.reduce((m, c) => Math.max(m, c.total_quantity), 0),
)
const barPct = (qty: number) =>
  maxCategoryQuantity.value > 0 ? (qty / maxCategoryQuantity.value) * 100 : 0

// --- Listado de inventario (CA1) ---------------------------------------------
const warehouseFilter = ref('')
const categoryFilter = ref('')
const onlyInStock = ref('')
const page = ref(1)

const { data: warehouses } = useAllWarehouses()
const warehouseOptions = computed(() => [
  { value: '', label: 'Todas las bodegas' },
  ...(warehouses.value ?? []).map((w) => ({ value: String(w.id), label: w.name })),
])
const categoryFilterOptions = [
  { value: '', label: 'Todas las categorías' },
  ...RESOURCE_CATEGORY_OPTIONS,
]
const stockFilterOptions = [
  { value: '', label: 'Todo el inventario' },
  { value: 'true', label: 'Solo con existencias' },
]

// Filtros activos (sin la página): al cambiar cualquiera se vuelve a la página 1.
const activeFilters = computed(() => ({
  ...(warehouseFilter.value ? { warehouse_id: Number(warehouseFilter.value) } : {}),
  ...(categoryFilter.value ? { category: categoryFilter.value as ResourceCategory } : {}),
  ...(onlyInStock.value ? { only_in_stock: onlyInStock.value === 'true' } : {}),
}))

// Clave de los filtros: si cambia respecto a la última carga, reseteamos a página 1
// de forma derivada (sin watch) para no pedir una página inexistente tras filtrar.
const lastFilterKey = ref('')
const params = computed<InventoryListParams>(() => {
  const key = JSON.stringify(activeFilters.value)
  if (key !== lastFilterKey.value) {
    lastFilterKey.value = key
    page.value = 1
  }
  return { page: page.value, limit: PAGE_SIZE, ...activeFilters.value }
})

const { data, isLoading, isFetching, isError, refetch } = useInventory(params)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(warehouseFilter.value || categoryFilter.value || onlyInStock.value))

function clearFilters() {
  warehouseFilter.value = ''
  categoryFilter.value = ''
  onlyInStock.value = ''
  page.value = 1
}
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}

const columns = [
  { key: 'resource', label: 'Recurso' },
  { key: 'category', label: 'Categoría' },
  { key: 'warehouse_name', label: 'Bodega' },
  { key: 'available_quantity', label: 'Cantidad', align: 'right' as const },
  { key: 'total_weight_kg', label: 'Peso (kg)', align: 'right' as const, mono: true },
  { key: 'expiration', label: 'Lote / Vence' },
]

const asRow = (r: unknown) => r as InventoryRow

// HU-15 CA3: estado de expiración para resaltar vencidos y próximos a vencer.
type ExpStatus = 'expired' | 'warning' | 'ok' | 'none'
function expStatus(row: InventoryRow): ExpStatus {
  if (row.is_expired) return 'expired'
  if (!row.expiration_date) return 'none'
  const exp = new Date(row.expiration_date)
  if (Number.isNaN(exp.getTime())) return 'none'
  const diffDays = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
  if (diffDays < 0) return 'expired'
  if (diffDays <= EXPIRATION_WARNING_DAYS) return 'warning'
  return 'ok'
}
// Clases del pill de expiración por estado (mismos tonos del sistema de diseño).
function expClass(status: ExpStatus): string {
  if (status === 'expired') return 'text-danger bg-danger-bg border-danger-br'
  if (status === 'warning') return 'text-warning bg-warning-bg border-warning-br'
  return 'text-neutral-500 bg-neutral-100 border-neutral-200'
}
// Filas de la página actual que requieren atención (vencidas o por vencer): alerta CA3.
const expiringRows = computed(() =>
  rows.value.filter((r) => {
    const s = expStatus(r)
    return s === 'expired' || s === 'warning'
  }),
)
</script>

<template>
  <section class="space-y-6">
    <PageHeader title="Inventario" crumb="Logística" subtitle="Existencias disponibles en bodegas" />

    <!-- ===== CA2: Resumen por categoría ===== -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
        Resumen por categoría
      </h2>

      <div v-if="summaryError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
        <p class="text-sm text-danger">No se pudo cargar el resumen de inventario.</p>
        <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetchSummary()">
          <RotateCcw /> Reintentar
        </AppButton>
      </div>

      <div v-else-if="summaryLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonBlock v-for="n in 4" :key="n" height="116px" />
      </div>

      <EmptyState
        v-else-if="categoryTotals.length === 0"
        title="Sin existencias"
        message="Aún no hay inventario registrado para resumir."
      >
        <template #icon><PackageX /></template>
      </EmptyState>

      <template v-else>
        <!-- KPIs: totales globales + una tarjeta por categoría -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Stock total" :value="fmt(totalQuantity)">
            <template #icon><Boxes /></template>
          </KpiCard>
          <KpiCard label="Peso total (kg)" :value="fmt(totalWeight)" tone="accent">
            <template #icon><Scale /></template>
          </KpiCard>
          <KpiCard
            v-for="cat in categoryTotals"
            :key="cat.category"
            :label="RESOURCE_CATEGORY_LABELS[cat.category]"
            :value="fmt(cat.total_quantity)"
          >
            <template #icon><Boxes /></template>
          </KpiCard>
        </div>

        <!-- Gráfico simple (barras CSS) comparando stock por categoría -->
        <div class="rounded-lg border border-neutral-200 bg-white p-5">
          <p class="mb-4 text-sm font-medium text-neutral-700">Stock por categoría</p>
          <div class="space-y-3">
            <div
              v-for="cat in categoryTotals"
              :key="cat.category"
              class="grid grid-cols-[120px_1fr_auto] items-center gap-3"
            >
              <span class="text-sm text-neutral-700">{{ RESOURCE_CATEGORY_LABELS[cat.category] }}</span>
              <ProgressBar :value="barPct(cat.total_quantity)" :ok="0" :warn="0" />
              <span class="w-16 text-right font-mono text-xs font-semibold text-neutral-900">
                {{ fmt(cat.total_quantity) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- ===== CA1: Listado de inventario ===== -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
        Listado de inventario
      </h2>

      <!-- Filtros -->
      <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
        <SelectField v-model="warehouseFilter" :options="warehouseOptions" />
        <SelectField v-model="categoryFilter" :options="categoryFilterOptions" />
        <SelectField v-model="onlyInStock" :options="stockFilterOptions" />
      </div>

      <!-- HU-15 CA3: alerta destacada de lotes vencidos / próximos a vencer -->
      <div
        v-if="expiringRows.length"
        class="flex items-start gap-3 rounded-lg border border-warning-br bg-warning-bg p-4"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p class="text-sm text-warning">
          <strong>{{ expiringRows.length }}</strong>
          {{ expiringRows.length === 1 ? 'lote requiere atención' : 'lotes requieren atención' }}
          (vencidos o por vencer en {{ EXPIRATION_WARNING_DAYS }} días) en esta página.
        </p>
      </div>

      <!-- Error -->
      <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
        <p class="text-sm text-danger">No se pudo cargar el inventario.</p>
        <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
          <RotateCcw /> Reintentar
        </AppButton>
      </div>

      <!-- Carga inicial -->
      <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
        <SkeletonBlock v-for="n in 8" :key="n" height="44px" />
      </div>

      <!-- Datos -->
      <template v-else>
        <div :class="{ 'opacity-60 transition-opacity': isFetching }">
          <DataTable :columns="columns" :rows="rows" row-key="id" min-width="880px">
            <template #resource="{ row }">
              <div>
                <p class="font-medium text-neutral-900">{{ asRow(row).resource.name }}</p>
                <p class="text-xs text-neutral-500">{{ asRow(row).resource.unit_of_measure }}</p>
              </div>
            </template>

            <template #category="{ row }">
              <span
                :class="[
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                  RESOURCE_CATEGORY_BADGE[asRow(row).resource.category],
                ]"
              >
                <span class="h-[7px] w-[7px] rounded-full bg-current" />
                {{ RESOURCE_CATEGORY_LABELS[asRow(row).resource.category] }}
              </span>
            </template>

            <template #available_quantity="{ row }">
              {{ fmt(asRow(row).available_quantity) }}
              <span class="text-xs text-neutral-500">{{ asRow(row).resource.unit_of_measure }}</span>
            </template>

            <template #total_weight_kg="{ row }">
              {{ fmt(asRow(row).total_weight_kg) }}
            </template>

            <!-- CA3: resalta visualmente expiraciones vencidas / próximas -->
            <template #expiration="{ row }">
              <div v-if="asRow(row).batch || asRow(row).expiration_date" class="space-y-1 text-xs">
                <p v-if="asRow(row).batch" class="font-mono text-neutral-600">{{ asRow(row).batch }}</p>
                <span
                  v-if="asRow(row).expiration_date"
                  :class="[
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold whitespace-nowrap',
                    expClass(expStatus(asRow(row))),
                  ]"
                >
                  <AlertTriangle
                    v-if="expStatus(asRow(row)) === 'expired' || expStatus(asRow(row)) === 'warning'"
                    class="h-3 w-3"
                  />
                  {{ asRow(row).expiration_date }}
                  <template v-if="expStatus(asRow(row)) === 'expired'"> · Vencido</template>
                  <template v-else-if="expStatus(asRow(row)) === 'warning'"> · Por vencer</template>
                </span>
              </div>
              <span v-else class="text-neutral-400">—</span>
            </template>

            <template #empty>
              <EmptyState
                title="Sin inventario"
                :message="hasFilters ? 'No hay existencias que coincidan con los filtros.' : 'Aún no hay inventario registrado.'"
              >
                <template #icon><SearchX /></template>
                <template #action>
                  <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                    <RotateCcw /> Limpiar filtros
                  </AppButton>
                </template>
              </EmptyState>
            </template>
          </DataTable>
        </div>

        <!-- Paginación -->
        <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
          <span>Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ fmt(total) }}</strong></span>
          <div class="flex items-center gap-2">
            <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
              Anterior
            </AppButton>
            <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
            <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
              Siguiente
            </AppButton>
          </div>
        </div>
      </template>
    </section>
  </section>
</template>
