<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, PackageX, RotateCcw, ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useDonations } from '@/composables/useDonations'
import { useAllDonors } from '@/composables/useDonors'
import { useAllWarehouses } from '@/composables/useWarehouses'
import {
  DONATION_TYPE_OPTIONS,
  DONATION_TYPE_LABELS,
  DONATION_TYPE_BADGE,
} from '@/types/donation.types'
import type { Donation, DonationListParams, DonationType } from '@/types/donation.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
// HU-19: registrar donaciones está restringido a admin y registro de donaciones.
const EDIT_ROLES = ['ADMIN', 'REGISTRADOR_DONACIONES'] as const

const router = useRouter()

// --- Filtros + listado --------------------------------------------------------
const donorFilter = ref('')
const warehouseFilter = ref('')
const typeFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)

const params = computed<DonationListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(donorFilter.value ? { donor_id: Number(donorFilter.value) } : {}),
  ...(warehouseFilter.value ? { warehouse_id: Number(warehouseFilter.value) } : {}),
  ...(typeFilter.value ? { type: typeFilter.value as DonationType } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useDonations(params)

// Catálogos para los selects de filtro y para resolver nombres de bodega.
const donorsQuery = useAllDonors()
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
  () => !!(donorFilter.value || warehouseFilter.value || typeFilter.value || dateFrom.value || dateTo.value),
)

const donorFilterOptions = computed(() => [
  { value: '', label: 'Todos los donantes' },
  ...(donorsQuery.data.value ?? []).map((d) => ({ value: d.id, label: d.name })),
])
const warehouseFilterOptions = computed(() => [
  { value: '', label: 'Todas las bodegas' },
  ...(warehousesQuery.data.value ?? []).map((w) => ({ value: w.id, label: w.name })),
])
const typeFilterOptions = computed(() => [
  { value: '', label: 'Todos los tipos' },
  ...DONATION_TYPE_OPTIONS,
])

const columns = [
  { key: 'donation_code', label: 'Código' },
  { key: 'donor', label: 'Donante' },
  { key: 'warehouse', label: 'Bodega destino' },
  { key: 'donation_type', label: 'Tipo' },
  { key: 'items', label: 'Recursos' },
  { key: 'weight', label: 'Peso total', align: 'right' as const },
  { key: 'amount', label: 'Monto', align: 'right' as const },
  { key: 'date', label: 'Fecha', align: 'right' as const },
]

const asDonation = (r: unknown) => r as Donation

// Peso total de la donación = suma del peso de sus items (el backend ya entrega el
// weight_kg calculado por renglón).
function totalWeight(d: Donation): number {
  return (d.details ?? []).reduce((acc, it) => acc + (Number(it.weight_kg) || 0), 0)
}

function formatWeight(kg: number): string {
  return `${kg.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`
}

function formatAmount(amount: string | null): string {
  if (amount == null || amount === '') return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CO')
}

// Resumen breve de items para mostrarlos en la fila (no hay página de detalle).
function itemsSummary(d: Donation): string {
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
  donorFilter.value = ''
  warehouseFilter.value = ''
  typeFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
function goToNew() {
  router.push({ name: 'donation-new' })
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Donaciones"
      crumb="Donaciones"
      :subtitle="total ? `${total} ${total === 1 ? 'donación registrada' : 'donaciones registradas'}` : 'Registro de donaciones recibidas'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="goToNew"><Plus /> Registrar donación</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <SelectField v-model="donorFilter" label="Donante" :options="donorFilterOptions" />
      <SelectField v-model="warehouseFilter" label="Bodega" :options="warehouseFilterOptions" />
      <SelectField v-model="typeFilter" label="Tipo" :options="typeFilterOptions" />
      <FormField label="Desde">
        <input v-model="dateFrom" type="date" class="control" />
      </FormField>
      <FormField label="Hasta">
        <input v-model="dateTo" type="date" class="control" />
      </FormField>
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las donaciones.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="980px">
          <template #donation_code="{ row }">
            <span class="font-mono text-xs font-semibold text-neutral-900">
              {{ asDonation(row).donation_code }}
            </span>
          </template>

          <template #donor="{ row }">
            <span class="text-neutral-700">{{ asDonation(row).donor?.name ?? '—' }}</span>
          </template>

          <template #warehouse="{ row }">
            <span class="text-neutral-700">
              {{
                asDonation(row).destination_warehouse_id
                  ? warehouseNameById.get(asDonation(row).destination_warehouse_id!) ?? '—'
                  : '—'
              }}
            </span>
          </template>

          <template #donation_type="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                DONATION_TYPE_BADGE[asDonation(row).donation_type],
              ]"
            >
              {{ DONATION_TYPE_LABELS[asDonation(row).donation_type] }}
            </span>
          </template>

          <template #items="{ row }">
            <span class="text-neutral-600">{{ itemsSummary(asDonation(row)) }}</span>
          </template>

          <template #weight="{ row }">
            <span class="font-mono text-xs text-neutral-700">
              {{ totalWeight(asDonation(row)) > 0 ? formatWeight(totalWeight(asDonation(row))) : '—' }}
            </span>
          </template>

          <template #amount="{ row }">
            <span class="font-mono text-xs text-neutral-700">
              {{ formatAmount(asDonation(row).monetary_amount) }}
            </span>
          </template>

          <template #date="{ row }">
            <span class="text-neutral-600">{{ formatDate(asDonation(row).date) }}</span>
          </template>

          <template #empty>
            <EmptyState
              title="Sin donaciones"
              :message="hasFilters ? 'No hay donaciones que coincidan con los filtros.' : 'Aún no se han registrado donaciones.'"
            >
              <template #icon><PackageX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="goToNew"><Plus /> Registrar donación</AppButton>
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
