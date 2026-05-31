<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, PackageX, RotateCcw, ChevronLeft, ChevronRight, Layers,
} from '@lucide/vue'
import { useDeliveries } from '@/composables/useDeliveries'
import { useAllWarehouses } from '@/composables/useWarehouses'
import {
  DELIVERY_STATUS_OPTIONS,
  type Delivery,
  type DeliveryListParams,
  type DeliveryStatus,
} from '@/types/delivery.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
// HU-22: registrar entregas — admin, coordinación de logística y operación de entregas.
const CREATE_ROLES = ['ADMIN', 'OPERADOR_ENTREGAS', 'COORDINADOR_LOGISTICA'] as const
// HU-23 lote: solo admin y coordinación de logística.
const BATCH_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const router = useRouter()

// --- Filtros + listado --------------------------------------------------------
const warehouseFilter = ref('')
const statusFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)

const params = computed<DeliveryListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(warehouseFilter.value ? { warehouse_id: Number(warehouseFilter.value) } : {}),
  ...(statusFilter.value ? { status: statusFilter.value as DeliveryStatus } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useDeliveries(params)

// Catálogo de bodegas para el filtro y para resolver nombres si no vienen anidados.
const warehousesQuery = useAllWarehouses()
const warehouseNameById = computed(() => {
  const map = new Map<number, string>()
  for (const w of warehousesQuery.data.value ?? []) map.set(w.id, w.name)
  return map
})

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(
  () => !!(warehouseFilter.value || statusFilter.value || dateFrom.value || dateTo.value),
)

const warehouseFilterOptions = computed(() => [
  { value: '', label: 'Todas las bodegas' },
  ...(warehousesQuery.data.value ?? []).map((w) => ({ value: w.id, label: w.name })),
])
const statusFilterOptions = [
  { value: '', label: 'Todos los estados' },
  ...DELIVERY_STATUS_OPTIONS,
]

const columns = [
  { key: 'delivery_code', label: 'Código' },
  { key: 'family', label: 'Familia' },
  { key: 'warehouse', label: 'Bodega origen' },
  { key: 'status', label: 'Estado' },
  { key: 'coverage', label: 'Cobertura', align: 'center' as const },
  { key: 'weight', label: 'Peso', align: 'right' as const },
  { key: 'items', label: 'Recursos' },
  { key: 'exception', label: 'Excepción', align: 'center' as const },
  { key: 'date', label: 'Fecha', align: 'right' as const },
]

const asDelivery = (r: unknown) => r as Delivery

// Nombre de la familia: el backend anida el objeto `family`; si no, mostramos el código.
function familyLabel(d: Delivery): string {
  return d.family?.family_code ?? `#${d.family_id}`
}
// Nombre de la bodega: viene anidado en `warehouse`; si no, resolvemos por id.
function warehouseLabel(d: Delivery): string {
  return d.warehouse?.name ?? warehouseNameById.value.get(d.source_warehouse_id) ?? '—'
}

// Peso total de la entrega = suma del peso de sus items (el backend ya entrega weight_kg
// calculado por renglón).
function totalWeight(d: Delivery): number {
  return (d.details ?? []).reduce((acc, it) => acc + (Number(it.weight_kg) || 0), 0)
}
function formatWeight(kg: number): string {
  return `${kg.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`
}
function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CO')
}

// Resumen breve de items para mostrarlos en la fila (no hay página de detalle).
function itemsSummary(d: Delivery): string {
  const items = d.details ?? []
  if (items.length === 0) return '—'
  const head = items
    .slice(0, 2)
    .map((it) => `${it.quantity}× ${it.resource_name}`)
    .join(', ')
  return items.length > 2 ? `${head} +${items.length - 2}` : head
}

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  warehouseFilter.value = ''
  statusFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Entregas"
      crumb="Entregas"
      :subtitle="total ? `${total} ${total === 1 ? 'entrega registrada' : 'entregas registradas'}` : 'Registro de entregas a familias'"
    >
      <template #actions>
        <RoleGate :roles="[...BATCH_ROLES]">
          <AppButton variant="outline" @click="router.push({ name: 'delivery-batch' })">
            <Layers /> Lote priorizado
          </AppButton>
        </RoleGate>
        <RoleGate :roles="[...CREATE_ROLES]">
          <AppButton @click="router.push({ name: 'delivery-new' })">
            <Plus /> Registrar entrega
          </AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField v-model="warehouseFilter" label="Bodega" :options="warehouseFilterOptions" />
      <SelectField v-model="statusFilter" label="Estado" :options="statusFilterOptions" />
      <FormField label="Desde">
        <input v-model="dateFrom" type="date" class="control" />
      </FormField>
      <FormField label="Hasta">
        <input v-model="dateTo" type="date" class="control" />
      </FormField>
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las entregas.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="1000px">
          <template #delivery_code="{ row }">
            <span class="font-mono text-xs font-semibold text-neutral-900">
              {{ asDelivery(row).delivery_code }}
            </span>
          </template>

          <template #family="{ row }">
            <span class="text-neutral-700">{{ familyLabel(asDelivery(row)) }}</span>
          </template>

          <template #warehouse="{ row }">
            <span class="text-neutral-700">{{ warehouseLabel(asDelivery(row)) }}</span>
          </template>

          <template #status="{ row }">
            <StatusBadge :status="asDelivery(row).status" />
          </template>

          <template #coverage="{ row }">
            <span class="text-neutral-600">{{ asDelivery(row).coverage_days }} días</span>
          </template>

          <template #weight="{ row }">
            <span class="font-mono text-xs text-neutral-700">
              {{ totalWeight(asDelivery(row)) > 0 ? formatWeight(totalWeight(asDelivery(row))) : '—' }}
            </span>
          </template>

          <template #items="{ row }">
            <span class="text-neutral-600">{{ itemsSummary(asDelivery(row)) }}</span>
          </template>

          <template #exception="{ row }">
            <span
              v-if="asDelivery(row).exception_reason"
              class="inline-flex items-center rounded-full border border-warning-br bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning"
              :title="asDelivery(row).exception_reason ?? ''"
            >
              Sí
            </span>
            <span v-else class="text-neutral-400">—</span>
          </template>

          <template #date="{ row }">
            <span class="text-neutral-600">{{ formatDate(asDelivery(row).delivery_date) }}</span>
          </template>

          <template #empty>
            <EmptyState
              title="Sin entregas"
              :message="hasFilters ? 'No hay entregas que coincidan con los filtros.' : 'Aún no se han registrado entregas.'"
            >
              <template #icon><PackageX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...CREATE_ROLES]">
                  <AppButton size="sm" @click="router.push({ name: 'delivery-new' })">
                    <Plus /> Registrar entrega
                  </AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <!-- Paginación -->
      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>
          Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong>
        </span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
            <ChevronLeft />
          </AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
            <ChevronRight />
          </AppButton>
        </div>
      </div>
    </template>
  </section>
</template>
