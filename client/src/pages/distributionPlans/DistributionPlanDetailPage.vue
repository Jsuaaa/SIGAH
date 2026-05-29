<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, PlayCircle, Ban, RotateCcw } from '@lucide/vue'
import { usePlan, usePlanMutations } from '@/composables/useDistributionPlans'
import {
  PLAN_STATUS_LABELS, PLAN_SCOPE_LABELS, PLAN_ITEM_STATUS_LABELS,
} from '@/types/distributionPlan.types'
import type { DistributionPlanItem, DistributionPlanItemStatus } from '@/types/distributionPlan.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const planId = computed(() => Number(route.params.id))
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const { data: plan, isLoading, isError, refetch } = usePlan(planId)
const { execute, cancel } = usePlanMutations()

const ITEM_BADGE: Record<DistributionPlanItemStatus, string> = {
  PENDIENTE: 'bg-neutral-100 text-neutral-600',
  ENTREGADO: 'bg-success-bg text-success',
  SIN_ATENDER: 'bg-warning-bg text-warning',
}
const counters = computed(() => [
  { label: 'Total', value: plan.value?.items_total ?? plan.value?.items?.length ?? 0, tone: 'text-neutral-900' },
  { label: 'Pendientes', value: plan.value?.items_pendientes ?? 0, tone: 'text-primary-700' },
  { label: 'Entregadas', value: plan.value?.items_entregados ?? 0, tone: 'text-success' },
  { label: 'Sin atender', value: plan.value?.items_sin_atender ?? 0, tone: 'text-warning' },
])

const columns = [
  { key: 'family_id', label: 'Familia', mono: true },
  { key: 'target_coverage_days', label: 'Cobertura', align: 'center' as const },
  { key: 'priority_score_snapshot', label: 'Puntaje', align: 'right' as const },
  { key: 'status', label: 'Estado' },
  { key: 'reason', label: 'Motivo' },
]
const asItem = (r: unknown) => r as DistributionPlanItem

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const confirmKind = ref<'execute' | 'cancel' | null>(null)
async function doConfirm() {
  const kind = confirmKind.value
  confirmKind.value = null
  if (!kind) return
  try {
    if (kind === 'execute') {
      await execute.mutateAsync(planId.value)
      toast.success('Plan ejecutado: entregas generadas')
    } else {
      await cancel.mutateAsync(planId.value)
      toast.success('Plan cancelado')
    }
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}
</script>

<template>
  <section class="space-y-5">
    <div v-if="isLoading" class="space-y-4"><SkeletonBlock height="120px" /><SkeletonBlock height="180px" /></div>
    <div v-else-if="isError || !plan" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el plan.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <template v-else>
      <PageHeader :title="plan.plan_code" :crumb="`Planes · ${PLAN_SCOPE_LABELS[plan.scope]}`">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/distribution-plans')"><ArrowLeft /> Volver</AppButton>
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton v-if="plan.status === 'PROGRAMADA'" :disabled="execute.isPending.value" @click="confirmKind = 'execute'">
              <PlayCircle /> Ejecutar
            </AppButton>
            <AppButton
              v-if="plan.status === 'PROGRAMADA' || plan.status === 'EN_EJECUCION'"
              variant="ghost"
              class="text-danger"
              :disabled="cancel.isPending.value"
              @click="confirmKind = 'cancel'"
            >
              <Ban /> Cancelar
            </AppButton>
          </RoleGate>
        </template>
      </PageHeader>

      <div class="rounded-lg border border-neutral-200 bg-white p-5">
        <div class="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <span class="rounded-full bg-info-bg px-2.5 py-1 text-xs font-semibold text-primary-700">{{ PLAN_STATUS_LABELS[plan.status] }}</span>
          <span>{{ PLAN_SCOPE_LABELS[plan.scope] }}</span>
          <span>· Creado {{ fmtDate(plan.created_at) }}</span>
        </div>
        <p v-if="plan.notes" class="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">{{ plan.notes }}</p>
      </div>

      <!-- Contadores -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="c in counters" :key="c.label" class="rounded-lg border border-neutral-200 bg-white p-4 text-center">
          <p :class="['text-2xl font-bold', c.tone]">{{ c.value }}</p>
          <p class="text-xs text-neutral-500">{{ c.label }}</p>
        </div>
      </div>

      <h2 class="text-sm font-semibold text-neutral-700">Familias del plan</h2>
      <DataTable :columns="columns" :rows="plan.items ?? []" row-key="id" min-width="720px">
        <template #family_id="{ row }">
          <button class="font-semibold text-primary-700 hover:underline" @click="router.push(`/families/${asItem(row).family_id}`)">
            #{{ asItem(row).family_id }}
          </button>
        </template>
        <template #target_coverage_days="{ row }">{{ asItem(row).target_coverage_days }} días</template>
        <template #priority_score_snapshot="{ row }"><span class="font-mono">{{ Math.round(asItem(row).priority_score_snapshot) }}</span></template>
        <template #status="{ row }">
          <span :class="['rounded-full px-2.5 py-1 text-xs font-semibold', ITEM_BADGE[asItem(row).status]]">{{ PLAN_ITEM_STATUS_LABELS[asItem(row).status] }}</span>
        </template>
        <template #reason="{ row }"><span class="text-xs text-neutral-500">{{ asItem(row).reason || '—' }}</span></template>
        <template #empty><p class="py-6 text-center text-sm text-neutral-500">El plan no tiene familias.</p></template>
      </DataTable>
    </template>

    <ConfirmDialog
      :open="confirmKind !== null"
      :tone="confirmKind === 'cancel' ? 'danger' : 'warning'"
      :title="confirmKind === 'execute' ? 'Ejecutar plan' : 'Cancelar plan'"
      :message="confirmKind === 'execute'
        ? 'Se generarán las entregas programadas para las familias del plan. ¿Continuar?'
        : 'El plan quedará cancelado y no se podrá ejecutar. ¿Continuar?'"
      :confirm-label="confirmKind === 'execute' ? 'Ejecutar' : 'Cancelar plan'"
      @confirm="doConfirm"
      @close="confirmKind = null"
    />
  </section>
</template>
