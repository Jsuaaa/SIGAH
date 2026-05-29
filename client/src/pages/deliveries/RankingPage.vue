<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RefreshCw, BarChart3, SearchX, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useRanking, useRecalculate } from '@/composables/usePrioritization'
import { useZones } from '@/composables/useZones'
import { FAMILY_STATUS_OPTIONS } from '@/types/family.types'
import type { FamilyScoreBreakdown, FamilyStatus } from '@/types/family.types'
import type { RankingParams, RankingRow } from '@/types/prioritization.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FamilyStatusBadge from '@/components/ui/FamilyStatusBadge.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import ScoreBreakdown from '@/components/ui/ScoreBreakdown.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 20
const RECALC_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const zoneFilter = ref('')
const statusFilter = ref('')
const page = ref(1)

const params = computed<RankingParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(zoneFilter.value ? { zone_id: Number(zoneFilter.value) } : {}),
  ...(statusFilter.value ? { status: statusFilter.value as FamilyStatus } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useRanking(params)
const { data: zones } = useZones()
const recalc = useRecalculate()

const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(zoneFilter.value || statusFilter.value))

// Filas con su posición global en el ranking.
const rows = computed(() =>
  (data.value?.data ?? []).map((r, i) => ({ ...r, _rank: rangeFrom.value + i })),
)

const zoneFilterOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const statusFilterOptions = [
  { value: '', label: 'Todos los estados' },
  ...FAMILY_STATUS_OPTIONS.map((s) => ({ value: s.value as string, label: s.label })),
]

const columns = [
  { key: '_rank', label: '#', align: 'center' as const },
  { key: 'family_code', label: 'Código', mono: true },
  { key: 'zone', label: 'Zona' },
  { key: 'num_members', label: 'Miembros', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'right' as const },
  { key: 'status', label: 'Estado' },
  { key: 'last_delivery_date', label: 'Última entrega' },
  { key: 'actions', label: '', align: 'right' as const },
]
const asRow = (r: unknown) => r as RankingRow & { _rank: number }

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'
}
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  zoneFilter.value = ''
  statusFilter.value = ''
}

async function recalculate() {
  try {
    const res = await recalc.mutateAsync()
    toast.success(`Puntajes recalculados (${res.recalculated} familias)`)
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Modal de desglose --------------------------------------------------------
const breakdownOpen = ref(false)
const breakdownRow = ref<RankingRow | null>(null)
function openBreakdown(r: RankingRow) {
  breakdownRow.value = r
  breakdownOpen.value = true
}
const breakdownFactors = computed(() => {
  const b = breakdownRow.value?.priority_score_breakdown as FamilyScoreBreakdown | undefined
  if (!b || typeof b.members !== 'number') return []
  const raw = [
    { name: 'Integrantes', points: b.members },
    { name: 'Niños < 5', points: b.children_u5 },
    { name: 'Adultos > 65', points: b.adults_o65 },
    { name: 'Gestantes', points: b.pregnant },
    { name: 'Discapacidad', points: b.disabled },
    { name: 'Riesgo de zona', points: b.zone_risk },
    { name: 'Días sin ayuda', points: b.days_no_aid },
  ]
  const maxPts = Math.max(1, ...raw.map((f) => f.points))
  return raw.map((f) => ({ name: f.name, points: Math.round(f.points), max: Math.round(maxPts) }))
})
const breakdownPositiveSum = computed(() => breakdownFactors.value.reduce((a, f) => a + f.points, 0))
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Ranking de prioridad"
      crumb="Ayudas"
      :subtitle="total ? `${total} familias priorizadas` : 'Familias ordenadas por puntaje de prioridad'"
    >
      <template #actions>
        <RoleGate :roles="[...RECALC_ROLES]">
          <AppButton variant="outline" :disabled="recalc.isPending.value" @click="recalculate">
            <RefreshCw /> {{ recalc.isPending.value ? 'Recalculando…' : 'Recalcular todos' }}
          </AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SelectField v-model="zoneFilter" :options="zoneFilterOptions" />
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el ranking.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 8" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="900px">
          <template #_rank="{ row }"><span class="font-mono font-semibold text-neutral-500">{{ asRow(row)._rank }}</span></template>
          <template #family_code="{ row }">
            <button class="font-semibold text-primary-700 hover:underline" @click="router.push(`/families/${asRow(row).id}`)">
              {{ asRow(row).family_code }}
            </button>
          </template>
          <template #zone="{ row }">
            <div class="flex items-center gap-2">
              <span>{{ zoneMap.get(asRow(row).zone_id)?.name ?? asRow(row).zone_name ?? '—' }}</span>
              <RiskLevelBadge v-if="zoneMap.get(asRow(row).zone_id)" :level="zoneMap.get(asRow(row).zone_id)!.risk_level" />
            </div>
          </template>
          <template #priority_score="{ row }"><span class="font-semibold text-neutral-900">{{ Math.round(asRow(row).priority_score) }}</span></template>
          <template #status="{ row }"><FamilyStatusBadge :status="asRow(row).status" /></template>
          <template #last_delivery_date="{ row }"><span class="text-sm text-neutral-600">{{ fmtDate(asRow(row).last_delivery_date) }}</span></template>
          <template #actions="{ row }">
            <AppButton variant="ghost" size="sm" @click="openBreakdown(asRow(row))"><BarChart3 /> Desglose</AppButton>
          </template>
          <template #empty>
            <EmptyState
              title="Sin familias"
              :message="hasFilters ? 'No hay familias que coincidan con los filtros.' : 'Aún no hay familias para priorizar.'"
            >
              <template #icon><SearchX /></template>
              <template v-if="hasFilters" #action>
                <AppButton variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
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

    <!-- Modal de desglose -->
    <BaseModal
      :open="breakdownOpen"
      :title="breakdownRow ? `Desglose · ${breakdownRow.family_code}` : ''"
      max-width="max-w-[480px]"
      @close="breakdownOpen = false"
    >
      <ScoreBreakdown
        v-if="breakdownRow && breakdownFactors.length"
        :factors="breakdownFactors"
        :total="Math.round(breakdownRow.priority_score)"
        :out-of="Math.max(breakdownPositiveSum, Math.round(breakdownRow.priority_score), 1)"
      />
      <p v-else class="text-sm text-neutral-500">Sin desglose disponible.</p>
      <template #footer>
        <AppButton variant="ghost" @click="breakdownOpen = false">Cerrar</AppButton>
        <AppButton v-if="breakdownRow" @click="router.push(`/families/${breakdownRow.id}`)">Ver familia</AppButton>
      </template>
    </BaseModal>
  </section>
</template>
