<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Play, Ban, RotateCcw, AlertTriangle } from '@lucide/vue'
import { useDistributionPlan, useDistributionPlanMutations } from '@/composables/useDistributionPlans'
import {
  DISTRIBUTION_PLAN_STATUS_LABELS,
  DISTRIBUTION_PLAN_STATUS_BADGE,
  DISTRIBUTION_PLAN_SCOPE_LABELS,
  DISTRIBUTION_PLAN_ITEM_STATUS_LABELS,
  DISTRIBUTION_PLAN_ITEM_STATUS_BADGE,
} from '@/types/distributionPlan.types'
import type { DistributionPlan, DistributionPlanItem } from '@/types/distributionPlan.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const MANAGE_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const route = useRoute()
const router = useRouter()

const id = computed(() => Number(route.params.id))
const { data: plan, isLoading, isError, refetch } = useDistributionPlan(id)

const items = computed<DistributionPlanItem[]>(() => plan.value?.items ?? [])
const unattended = computed(() => items.value.filter((i) => i.status === 'SIN_ATENDER'))

const canExecute = computed(() => plan.value?.status === 'PROGRAMADA')
const canCancel = computed(
  () => plan.value?.status === 'PROGRAMADA' || plan.value?.status === 'EN_EJECUCION',
)

const dateFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

const columns = [
  { key: 'family_id', label: 'Familia', align: 'left' as const },
  { key: 'priority_score_snapshot', label: 'Puntaje', align: 'center' as const },
  { key: 'target_coverage_days', label: 'Cobertura', align: 'center' as const },
  { key: 'status', label: 'Estado', align: 'left' as const },
  { key: 'reason', label: 'Motivo', align: 'left' as const },
]
const asItem = (r: unknown) => r as DistributionPlanItem

// --- Acciones (ejecutar / cancelar) ------------------------------------------
const { execute, cancel } = useDistributionPlanMutations()
const busy = computed(() => execute.isPending.value || cancel.isPending.value)

const confirmOpen = ref(false)
const action = ref<'execute' | 'cancel' | null>(null)

function askExecute() {
  action.value = 'execute'
  confirmOpen.value = true
}
function askCancel() {
  action.value = 'cancel'
  confirmOpen.value = true
}

const p = computed(() => plan.value as DistributionPlan | undefined)
const confirmText = computed(() => {
  if (action.value === 'execute') {
    return {
      title: 'Ejecutar plan',
      message: `¿Ejecutar el plan ${p.value?.plan_code ?? ''}? Se generarán las entregas de las familias pendientes y se descontará el inventario.`,
      label: 'Ejecutar',
      tone: 'warning' as const,
    }
  }
  return {
    title: 'Cancelar plan',
    message: `¿Cancelar el plan ${p.value?.plan_code ?? ''}? Esta acción no se puede deshacer.`,
    label: 'Cancelar plan',
    tone: 'danger' as const,
  }
})

async function confirmAction() {
  if (!action.value || !plan.value) return
  const verb = action.value
  try {
    if (verb === 'execute') {
      await execute.mutateAsync(plan.value.id)
      toast.success('Plan en ejecución. Entregas generadas.')
    } else {
      await cancel.mutateAsync(plan.value.id)
      toast.success('Plan cancelado.')
    }
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    confirmOpen.value = false
    action.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      :title="plan ? `Plan ${plan.plan_code}` : 'Plan de distribución'"
      crumb="Logística"
      :subtitle="plan ? `Alcance ${DISTRIBUTION_PLAN_SCOPE_LABELS[plan.scope]} · creado el ${formatDate(plan.created_at)}` : ''"
    >
      <template #actions>
        <AppButton variant="ghost" @click="router.push('/distribution-plans')">Volver</AppButton>
        <RoleGate :roles="[...MANAGE_ROLES]">
          <AppButton v-if="canExecute" :disabled="busy" @click="askExecute"><Play /> Ejecutar</AppButton>
          <AppButton v-if="canCancel" variant="danger" :disabled="busy" @click="askCancel">
            <Ban /> Cancelar
          </AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el plan.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga -->
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 8" :key="n" height="44px" />
    </div>

    <template v-else-if="plan">
      <!-- Resumen / estado + contadores -->
      <div class="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <span
          :class="[
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
            DISTRIBUTION_PLAN_STATUS_BADGE[plan.status],
          ]"
        >
          <span class="h-[7px] w-[7px] rounded-full bg-current" />
          {{ DISTRIBUTION_PLAN_STATUS_LABELS[plan.status] }}
        </span>
        <span class="text-sm text-neutral-600">
          <strong>{{ items.length }}</strong> {{ items.length === 1 ? 'familia' : 'familias' }} en el plan
        </span>
        <span v-if="plan.notes" class="text-sm text-neutral-500">· {{ plan.notes }}</span>
      </div>

      <!-- Destacado: familias sin atender por falta de stock (SIN_ATENDER) -->
      <div
        v-if="unattended.length"
        class="flex items-start gap-3 rounded-lg border border-warning-br bg-warning-bg p-4"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div class="text-sm">
          <p class="font-semibold text-warning">
            {{ unattended.length }}
            {{ unattended.length === 1 ? 'familia quedó sin atender' : 'familias quedaron sin atender' }}
            por falta de stock o elegibilidad
          </p>
          <p class="mt-0.5 text-neutral-600">
            Revisa el motivo en cada renglón. Reabastece las bodegas y genera un nuevo plan si es necesario.
          </p>
        </div>
      </div>

      <!-- Items del plan -->
      <DataTable :columns="columns" :rows="items" row-key="id" min-width="720px">
        <template #family_id="{ row }">
          <button
            type="button"
            class="font-mono text-xs font-semibold text-primary-700 hover:underline"
            @click="router.push(`/families/${asItem(row).family_id}`)"
          >
            #{{ asItem(row).family_id }}
          </button>
        </template>
        <template #priority_score_snapshot="{ row }">
          <span class="font-semibold text-primary-700">{{ asItem(row).priority_score_snapshot }}</span>
        </template>
        <template #target_coverage_days="{ row }">
          {{ asItem(row).target_coverage_days }} días
        </template>
        <template #status="{ row }">
          <span
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
              DISTRIBUTION_PLAN_ITEM_STATUS_BADGE[asItem(row).status],
            ]"
          >
            <span class="h-[7px] w-[7px] rounded-full bg-current" />
            {{ DISTRIBUTION_PLAN_ITEM_STATUS_LABELS[asItem(row).status] }}
          </span>
        </template>
        <template #reason="{ row }">
          <span class="text-xs text-neutral-500">{{ asItem(row).reason ?? '—' }}</span>
        </template>
        <template #empty>
          <p class="px-4 py-10 text-center text-sm text-neutral-500">Este plan no tiene familias.</p>
        </template>
      </DataTable>
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
