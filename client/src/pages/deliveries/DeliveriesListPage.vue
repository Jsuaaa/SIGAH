<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Layers, Eye, SearchX, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useDeliveriesList } from '@/composables/useDeliveries'
import { useWarehouses } from '@/composables/useWarehouses'
import { DELIVERY_STATUS_OPTIONS } from '@/types/delivery.types'
import type { DeliveryEnriched, DeliveryListParams, DeliveryStatus } from '@/types/delivery.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 20
const CREATE_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'] as const
const BATCH_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const statusFilter = ref('')
const warehouseFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
watch([statusFilter, warehouseFilter, dateFrom, dateTo], () => {
  page.value = 1
})

const params = computed<DeliveryListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(statusFilter.value ? { status: statusFilter.value as DeliveryStatus } : {}),
  ...(warehouseFilter.value ? { warehouse_id: Number(warehouseFilter.value) } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useDeliveriesList(params)
const { data: warehouses } = useWarehouses()

const warehouseMap = computed(() => new Map((warehouses.value ?? []).map((w) => [w.id, w])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(statusFilter.value || warehouseFilter.value || dateFrom.value || dateTo.value))

const statusOptions = [{ value: '', label: 'Todos los estados' }, ...DELIVERY_STATUS_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))]
const warehouseOptions = computed(() => [
  { value: '', label: 'Todas las bodegas' },
  ...(warehouses.value ?? []).map((w) => ({ value: String(w.id), label: w.name })),
])

const columns = [
  { key: 'delivery_code', label: 'Código', mono: true },
  { key: 'family', label: 'Familia' },
  { key: 'warehouse', label: 'Bodega' },
  { key: 'delivery_date', label: 'Fecha' },
  { key: 'coverage_days', label: 'Cobertura', align: 'center' as const },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '', align: 'right' as const },
]
const asDelivery = (r: unknown) => r as DeliveryEnriched

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  statusFilter.value = ''
  warehouseFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Entregas"
      crumb="Ayudas"
      :subtitle="total ? `${total} ${total === 1 ? 'entrega' : 'entregas'}` : 'Entregas de ayuda humanitaria'"
    >
      <template #actions>
        <RoleGate :roles="[...BATCH_ROLES]">
          <AppButton variant="outline" @click="router.push('/deliveries/batch')"><Layers /> Por lote</AppButton>
        </RoleGate>
        <RoleGate :roles="[...CREATE_ROLES]">
          <AppButton @click="router.push('/deliveries/new')"><Plus /> Crear entrega</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField v-model="statusFilter" :options="statusOptions" />
      <SelectField v-model="warehouseFilter" :options="warehouseOptions" />
      <FormField label="" input-id="dl-from"><input id="dl-from" v-model="dateFrom" type="date" class="control" /></FormField>
      <FormField label="" input-id="dl-to"><input id="dl-to" v-model="dateTo" type="date" class="control" /></FormField>
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las entregas.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="880px">
          <template #delivery_code="{ row }"><span class="font-semibold text-neutral-900">{{ asDelivery(row).delivery_code }}</span></template>
          <template #family="{ row }">{{ asDelivery(row).family?.family_code ?? `#${asDelivery(row).family_id}` }}</template>
          <template #warehouse="{ row }">{{ asDelivery(row).warehouse?.name ?? warehouseMap.get(asDelivery(row).source_warehouse_id)?.name ?? '—' }}</template>
          <template #delivery_date="{ row }">{{ fmtDate(asDelivery(row).delivery_date) }}</template>
          <template #coverage_days="{ row }">{{ asDelivery(row).coverage_days }} días</template>
          <template #status="{ row }"><StatusBadge :status="asDelivery(row).status" /></template>
          <template #actions="{ row }">
            <AppButton variant="ghost" size="sm" @click="router.push(`/deliveries/${asDelivery(row).id}`)"><Eye /> Ver</AppButton>
          </template>
          <template #empty>
            <EmptyState
              title="Sin entregas"
              :message="hasFilters ? 'No hay entregas que coincidan con los filtros.' : 'Aún no se han registrado entregas.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
                <RoleGate v-else :roles="[...CREATE_ROLES]">
                  <AppButton size="sm" @click="router.push('/deliveries/new')"><Plus /> Crear entrega</AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong></span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>
  </section>
</template>
