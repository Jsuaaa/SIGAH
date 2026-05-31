<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Plus, Play, Ban, PackageX, RotateCcw, ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useDistributionPlans, useDistributionPlanMutations } from '@/composables/useDistributionPlans'
import {
  DISTRIBUTION_PLAN_STATUS_LABELS,
  DISTRIBUTION_PLAN_STATUS_BADGE,
  DISTRIBUTION_PLAN_SCOPE_LABELS,
} from '@/types/distributionPlan.types'
import type {
  DistributionPlan,
  DistributionPlanListParams,
  DistributionPlanScope,
  DistributionPlanStatus,
} from '@/types/distributionPlan.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
const MANAGE_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const router = useRouter()

// --- Filtros + listado --------------------------------------------------------
const statusFilter = ref('')
const scopeFilter = ref('')
const page = ref(1)

const params = computed<DistributionPlanListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(statusFilter.value ? { status: statusFilter.value as DistributionPlanStatus } : {}),
  ...(scopeFilter.value ? { scope: scopeFilter.value as DistributionPlanScope } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useDistributionPlans(params)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(statusFilter.value || scopeFilter.value))

const statusFilterOptions = [
  { value: '', label: 'Todos los estados' },
  ...(Object.entries(DISTRIBUTION_PLAN_STATUS_LABELS) as [DistributionPlanStatus, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
]
const scopeFilterOptions = [
  { value: '', label: 'Todos los alcances' },
  ...(Object.entries(DISTRIBUTION_PLAN_SCOPE_LABELS) as [DistributionPlanScope, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
]

const columns = [
  { key: 'plan_code', label: 'Código' },
  { key: 'scope', label: 'Alcance' },
  { key: 'status', label: 'Estado' },
  { key: 'items', label: 'Familias', align: 'center' as const },
  { key: 'created_at', label: 'Creado', align: 'left' as const },
  { key: 'actions', label: '', align: 'right' as const },
]

const asPlan = (r: unknown) => r as DistributionPlan
const dateFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })
function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

// Solo se puede ejecutar un plan PROGRAMADA; cancelar PROGRAMADA o EN_EJECUCION.
function canExecute(p: DistributionPlan) {
  return p.status === 'PROGRAMADA'
}
function canCancel(p: DistributionPlan) {
  return p.status === 'PROGRAMADA' || p.status === 'EN_EJECUCION'
}

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  statusFilter.value = ''
  scopeFilter.value = ''
}

// --- Acciones (ejecutar / cancelar) ------------------------------------------
const { execute, cancel } = useDistributionPlanMutations()
const busy = computed(() => execute.isPending.value || cancel.isPending.value)

const confirmOpen = ref(false)
const action = ref<'execute' | 'cancel' | null>(null)
const target = ref<DistributionPlan | null>(null)

function askExecute(p: DistributionPlan) {
  action.value = 'execute'
  target.value = p
  confirmOpen.value = true
}
function askCancel(p: DistributionPlan) {
  action.value = 'cancel'
  target.value = p
  confirmOpen.value = true
}

const confirmText = computed(() => {
  if (!target.value || !action.value) return { title: '', message: '', label: '', tone: 'danger' as const }
  if (action.value === 'execute') {
    return {
      title: 'Ejecutar plan',
      message: `¿Ejecutar el plan ${target.value.plan_code}? Se generarán las entregas de las familias pendientes y se descontará el inventario.`,
      label: 'Ejecutar',
      tone: 'warning' as const,
    }
  }
  return {
    title: 'Cancelar plan',
    message: `¿Cancelar el plan ${target.value.plan_code}? Esta acción no se puede deshacer.`,
    label: 'Cancelar plan',
    tone: 'danger' as const,
  }
})

async function confirmAction() {
  if (!target.value || !action.value) return
  const id = target.value.id
  const verb = action.value
  try {
    if (verb === 'execute') {
      await execute.mutateAsync(id)
      toast.success('Plan en ejecución. Entregas generadas.')
    } else {
      await cancel.mutateAsync(id)
      toast.success('Plan cancelado.')
    }
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    confirmOpen.value = false
    target.value = null
    action.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Planes de distribución"
      crumb="Logística"
      :subtitle="total ? `${total} ${total === 1 ? 'plan registrado' : 'planes registrados'}` : 'Generación priorizada de entregas'"
    >
      <template #actions>
        <RoleGate :roles="[...MANAGE_ROLES]">
          <AppButton @click="router.push('/distribution-plans/new')"><Plus /> Nuevo plan</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
      <SelectField v-model="scopeFilter" :options="scopeFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los planes de distribución.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="860px">
          <template #plan_code="{ row }">
            <button
              type="button"
              class="text-left"
              @click="router.push(`/distribution-plans/${asPlan(row).id}`)"
            >
              <span class="font-mono text-xs font-semibold text-primary-700 hover:underline">
                {{ asPlan(row).plan_code }}
              </span>
            </button>
          </template>

          <template #scope="{ row }">
            {{ DISTRIBUTION_PLAN_SCOPE_LABELS[asPlan(row).scope] }}
          </template>

          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                DISTRIBUTION_PLAN_STATUS_BADGE[asPlan(row).status],
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ DISTRIBUTION_PLAN_STATUS_LABELS[asPlan(row).status] }}
            </span>
          </template>

          <template #items="{ row }">
            <div class="flex flex-col items-center gap-0.5 text-xs">
              <span class="font-semibold text-neutral-700">{{ asPlan(row).items_total ?? 0 }}</span>
              <span v-if="asPlan(row).items_sin_atender" class="text-warning">
                {{ asPlan(row).items_sin_atender }} sin atender
              </span>
            </div>
          </template>

          <template #created_at="{ row }">
            <span class="text-xs text-neutral-500">{{ formatDate(asPlan(row).created_at) }}</span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...MANAGE_ROLES]">
                <AppButton
                  v-if="canExecute(asPlan(row))"
                  variant="ghost"
                  size="sm"
                  class="text-primary-700"
                  :disabled="busy"
                  @click="askExecute(asPlan(row))"
                >
                  <Play /> Ejecutar
                </AppButton>
                <AppButton
                  v-if="canCancel(asPlan(row))"
                  variant="ghost"
                  size="sm"
                  class="text-danger"
                  :disabled="busy"
                  @click="askCancel(asPlan(row))"
                >
                  <Ban /> Cancelar
                </AppButton>
              </RoleGate>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin planes de distribución"
              :message="hasFilters ? 'No hay planes que coincidan con los filtros.' : 'Aún no se han generado planes de distribución.'"
            >
              <template #icon><PackageX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...MANAGE_ROLES]">
                  <AppButton size="sm" @click="router.push('/distribution-plans/new')">
                    <Plus /> Nuevo plan
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

    <!-- Confirmar ejecutar / cancelar -->
    <ConfirmDialog
      :open="confirmOpen"
      :title="confirmText.title"
      :message="confirmText.message"
      :confirm-label="confirmText.label"
      :tone="confirmText.tone"
      @confirm="confirmAction"
      @close="confirmOpen = false"
    />
  </section>
</template>
