<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Eye, SearchX, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { usePlansList } from '@/composables/useDistributionPlans'
import {
  PLAN_STATUS_OPTIONS, PLAN_STATUS_LABELS, PLAN_SCOPE_OPTIONS, PLAN_SCOPE_LABELS,
} from '@/types/distributionPlan.types'
import type {
  DistributionPlanScope, DistributionPlanStatus, DistributionPlanWithItems, PlanListParams,
} from '@/types/distributionPlan.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const STATUS_BADGE: Record<DistributionPlanStatus, string> = {
  PROGRAMADA: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  EN_EJECUCION: 'bg-info-bg text-primary-700 border-info-br',
  COMPLETADA: 'bg-success-bg text-success border-success-br',
  CANCELADA: 'bg-danger-bg text-danger border-danger-br',
}

const statusFilter = ref('')
const scopeFilter = ref('')
const page = ref(1)
watch([statusFilter, scopeFilter], () => { page.value = 1 })

const params = computed<PlanListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(statusFilter.value ? { status: statusFilter.value as DistributionPlanStatus } : {}),
  ...(scopeFilter.value ? { scope: scopeFilter.value as DistributionPlanScope } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = usePlansList(params)
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(statusFilter.value || scopeFilter.value))

const statusOptions = [{ value: '', label: 'Todos los estados' }, ...PLAN_STATUS_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))]
const scopeOptions = [{ value: '', label: 'Todos los alcances' }, ...PLAN_SCOPE_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))]

const columns = [
  { key: 'plan_code', label: 'Código', mono: true },
  { key: 'scope', label: 'Alcance' },
  { key: 'created_at', label: 'Creado' },
  { key: 'status', label: 'Estado' },
  { key: 'progress', label: 'Avance', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]
const asPlan = (r: unknown) => r as DistributionPlanWithItems

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function goTo(p: number) { page.value = Math.min(Math.max(1, p), totalPages.value) }
function clearFilters() { statusFilter.value = ''; scopeFilter.value = '' }
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Planes de distribución"
      crumb="Ayudas"
      :subtitle="total ? `${total} ${total === 1 ? 'plan' : 'planes'}` : 'Generación priorizada de entregas (HU-21)'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="router.push('/distribution-plans/new')"><Plus /> Nuevo plan</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SelectField v-model="statusFilter" :options="statusOptions" />
      <SelectField v-model="scopeFilter" :options="scopeOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los planes.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="820px">
          <template #plan_code="{ row }"><span class="font-semibold text-neutral-900">{{ asPlan(row).plan_code }}</span></template>
          <template #scope="{ row }">{{ PLAN_SCOPE_LABELS[asPlan(row).scope] }}</template>
          <template #created_at="{ row }">{{ fmtDate(asPlan(row).created_at) }}</template>
          <template #status="{ row }">
            <span :class="['inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[asPlan(row).status]]">
              {{ PLAN_STATUS_LABELS[asPlan(row).status] }}
            </span>
          </template>
          <template #progress="{ row }">
            <span class="font-mono text-xs">{{ asPlan(row).items_entregados ?? 0 }}/{{ asPlan(row).items_total ?? 0 }}</span>
            <span v-if="(asPlan(row).items_sin_atender ?? 0) > 0" class="ml-2 text-xs font-semibold text-warning">
              {{ asPlan(row).items_sin_atender }} sin atender
            </span>
          </template>
          <template #actions="{ row }">
            <AppButton variant="ghost" size="sm" @click="router.push(`/distribution-plans/${asPlan(row).id}`)"><Eye /> Ver</AppButton>
          </template>
          <template #empty>
            <EmptyState
              title="Sin planes"
              :message="hasFilters ? 'No hay planes que coincidan con los filtros.' : 'Aún no se han generado planes de distribución.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="router.push('/distribution-plans/new')"><Plus /> Nuevo plan</AppButton>
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
