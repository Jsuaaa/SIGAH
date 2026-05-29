<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Eye, SearchX, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useDonationsList } from '@/composables/useDonations'
import { useDonors } from '@/composables/useDonors'
import { DONATION_TYPE_OPTIONS, DONATION_TYPE_LABELS } from '@/types/donation.types'
import type { DonationEnriched, DonationListParams, DonationType } from '@/types/donation.types'
import { RESOURCE_CATEGORY_LABELS } from '@/types/inventory.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] as const

const donorFilter = ref('')
const typeFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)

watch([donorFilter, typeFilter, dateFrom, dateTo], () => {
  page.value = 1
})

const params = computed<DonationListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(donorFilter.value ? { donor_id: Number(donorFilter.value) } : {}),
  ...(typeFilter.value ? { type: typeFilter.value as DonationType } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useDonationsList(params)
const { data: donors } = useDonors()

const donorMap = computed(() => new Map((donors.value ?? []).map((d) => [d.id, d])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(donorFilter.value || typeFilter.value || dateFrom.value || dateTo.value))

const donorOptions = computed(() => [
  { value: '', label: 'Todos los donantes' },
  ...(donors.value ?? []).map((d) => ({ value: String(d.id), label: d.name })),
])
const typeFilterOptions = [{ value: '', label: 'Todos los tipos' }, ...DONATION_TYPE_OPTIONS]

const columns = [
  { key: 'donation_code', label: 'Código', mono: true },
  { key: 'donor', label: 'Donante' },
  { key: 'donation_type', label: 'Tipo' },
  { key: 'date', label: 'Fecha' },
  { key: 'amount', label: 'Monto', align: 'right' as const },
  { key: 'items', label: 'Ítems', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]
const asDonation = (r: unknown) => r as DonationEnriched

function donorName(d: DonationEnriched) {
  return d.donor?.name ?? donorMap.value.get(d.donor_id)?.name ?? `#${d.donor_id}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMoney(v: string | null) {
  if (!v) return '—'
  return Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  donorFilter.value = ''
  typeFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

// --- Modal de detalle ---------------------------------------------------------
const detailOpen = ref(false)
const detail = ref<DonationEnriched | null>(null)
function openDetail(d: DonationEnriched) {
  detail.value = d
  detailOpen.value = true
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Donaciones"
      crumb="Ayudas"
      :subtitle="total ? `${total} ${total === 1 ? 'donación' : 'donaciones'}` : 'Registro de donaciones recibidas'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="router.push('/donations/new')"><Plus /> Registrar donación</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField v-model="donorFilter" :options="donorOptions" />
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
      <FormField label="" input-id="d-from"><input id="d-from" v-model="dateFrom" type="date" class="control" /></FormField>
      <FormField label="" input-id="d-to"><input id="d-to" v-model="dateTo" type="date" class="control" /></FormField>
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las donaciones.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="900px">
          <template #donation_code="{ row }"><span class="font-semibold text-neutral-900">{{ asDonation(row).donation_code }}</span></template>
          <template #donor="{ row }">{{ donorName(asDonation(row)) }}</template>
          <template #donation_type="{ row }">
            <span class="rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-primary-700">
              {{ DONATION_TYPE_LABELS[asDonation(row).donation_type] }}
            </span>
          </template>
          <template #date="{ row }">{{ fmtDate(asDonation(row).date) }}</template>
          <template #amount="{ row }"><span class="font-mono text-xs">{{ fmtMoney(asDonation(row).monetary_amount) }}</span></template>
          <template #items="{ row }">{{ asDonation(row).details?.length ?? 0 }}</template>
          <template #actions="{ row }">
            <AppButton variant="ghost" size="sm" @click="openDetail(asDonation(row))"><Eye /> Ver</AppButton>
          </template>
          <template #empty>
            <EmptyState
              title="Sin donaciones"
              :message="hasFilters ? 'No hay donaciones que coincidan con los filtros.' : 'Aún no se han registrado donaciones.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="router.push('/donations/new')"><Plus /> Registrar donación</AppButton>
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

    <!-- Modal de detalle -->
    <BaseModal :open="detailOpen" :title="detail ? `Donación ${detail.donation_code}` : ''" max-width="max-w-[600px]" @close="detailOpen = false">
      <div v-if="detail" class="space-y-4">
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-neutral-500">Donante</dt><dd class="font-medium text-neutral-900">{{ donorName(detail) }}</dd></div>
          <div><dt class="text-neutral-500">Tipo</dt><dd class="font-medium text-neutral-900">{{ DONATION_TYPE_LABELS[detail.donation_type] }}</dd></div>
          <div><dt class="text-neutral-500">Fecha</dt><dd class="font-medium text-neutral-900">{{ fmtDate(detail.date) }}</dd></div>
          <div><dt class="text-neutral-500">Monto</dt><dd class="font-medium text-neutral-900">{{ fmtMoney(detail.monetary_amount) }}</dd></div>
        </dl>
        <p v-if="detail.notes" class="rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">{{ detail.notes }}</p>

        <div v-if="detail.details?.length">
          <h3 class="mb-2 text-sm font-semibold text-neutral-700">Ítems en especie</h3>
          <ul class="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            <li v-for="it in detail.details" :key="it.id" class="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <span class="font-medium text-neutral-900">{{ it.resource_name }}</span>
                <span class="ml-1 text-xs text-neutral-500">({{ RESOURCE_CATEGORY_LABELS[it.category] }})</span>
              </span>
              <span class="font-mono text-xs text-neutral-700">{{ it.quantity }} u · {{ Math.round(it.weight_kg).toLocaleString('es-CO') }} kg</span>
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <AppButton @click="detailOpen = false">Cerrar</AppButton>
      </template>
    </BaseModal>
  </section>
</template>
