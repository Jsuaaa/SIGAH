<script setup lang="ts">
/**
 * HU-28 — Familias no atendidas (CA3).
 * Tabla de familias activas sin cobertura vigente, ordenada por priority_score
 * desc (lo hace el backend). Filtro por zona y por "sin entrega desde" (since),
 * paginada. Cada fila enlaza a "Crear entrega" (/deliveries/new?family=ID).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RotateCcw, SearchX, Truck, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useUnattendedFamilies } from '@/composables/useReports'
import { useZones } from '@/composables/useZones'
import type { UnattendedFamiliesFilters, UnattendedFamily, UnattendedReason } from '@/types/report.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import SelectField from '@/components/form/SelectField.vue'
import InputField from '@/components/form/InputField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 20
const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

const zoneId = ref('')
const since = ref('')
const page = ref(1)

watch([zoneId, since], () => {
  page.value = 1
})

const filters = computed<UnattendedFamiliesFilters>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(zoneId.value ? { zone_id: Number(zoneId.value) } : {}),
  ...(since.value ? { since: since.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useUnattendedFamilies(filters)
const { data: zones } = useZones()

const rows = computed<UnattendedFamily[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(zoneId.value || since.value))

const zoneOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])

const REASON_LABELS: Record<UnattendedReason, string> = {
  NEVER_RECEIVED: 'Nunca recibió',
  COVERAGE_EXPIRED: 'Cobertura vencida',
}
const REASON_BADGE: Record<UnattendedReason, string> = {
  NEVER_RECEIVED: 'text-danger bg-danger-bg border-danger-br',
  COVERAGE_EXPIRED: 'text-warning bg-warning-bg border-warning-br',
}

const columns = [
  { key: 'family_code', label: 'Código', mono: true },
  { key: 'family_name', label: 'Documento', mono: true },
  { key: 'zone_name', label: 'Zona' },
  { key: 'reason', label: 'Motivo' },
  { key: 'days_since_last_delivery', label: 'Días sin ayuda', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'right' as const, mono: true },
  { key: 'actions', label: '', align: 'right' as const },
]
const asRow = (r: unknown) => r as UnattendedFamily

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  zoneId.value = ''
  since.value = ''
}
function createDelivery(familyId: number) {
  router.push({ path: '/deliveries/new', query: { family: String(familyId) } })
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Familias no atendidas"
      crumb="Analítica y control"
      :subtitle="total ? `${fmt(total)} familias sin cobertura vigente` : 'Familias priorizadas sin ayuda vigente (HU-28)'"
    />

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SelectField v-model="zoneId" label="Zona" :options="zoneOptions" />
      <InputField v-model="since" label="Sin entrega desde" type="date" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las familias.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="family_id" min-width="820px">
          <template #family_code="{ value }">
            <span class="font-semibold text-neutral-900">{{ value }}</span>
          </template>

          <template #reason="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                REASON_BADGE[asRow(row).reason],
              ]"
            >
              {{ REASON_LABELS[asRow(row).reason] }}
            </span>
          </template>

          <template #priority_score="{ value }">
            <span class="font-semibold text-neutral-900">{{ Math.round(Number(value ?? 0)) }}</span>
          </template>

          <template #actions="{ row }">
            <RoleGate :roles="['ADMIN', 'OPERADOR_ENTREGAS', 'COORDINADOR_LOGISTICA']">
              <AppButton variant="outline" size="sm" @click="createDelivery(asRow(row).family_id)">
                <Truck /> Crear entrega
              </AppButton>
            </RoleGate>
          </template>

          <template #empty>
            <EmptyState
              title="Sin familias pendientes"
              :message="hasFilters ? 'No hay familias sin atender que coincidan con los filtros.' : 'Todas las familias activas tienen cobertura vigente.'"
            >
              <template #icon><SearchX /></template>
              <template v-if="hasFilters" #action>
                <AppButton variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <!-- Paginación -->
      <div
        v-if="total > 0"
        class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600"
      >
        <span>
          Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ fmt(total) }}</strong>
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
