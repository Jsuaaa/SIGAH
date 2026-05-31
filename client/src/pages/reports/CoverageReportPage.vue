<script setup lang="ts">
/**
 * HU-28 — Reporte de cobertura de ayuda por zona (CA1).
 * KPIs globales + desglose por zona (barras CSS) + tabla, con exportación a
 * PDF/Excel mediante el parámetro ?format del backend (ExportButtons).
 *
 * Nota: GET /reports/coverage no acepta filtros en el backend actual; el reporte
 * es global por zona. "covered" = familias con cobertura vigente (RF-28 CA1).
 */
import { computed, ref } from 'vue'
import { RotateCcw, ChartColumn, Users, ShieldCheck, MapPin } from '@lucide/vue'
import { useCoverageReport } from '@/composables/useReports'
import { reportsApi } from '@/api/reports.api'
import { toast } from 'vue-sonner'
import { apiErrorMessage } from '@/utils/apiError'
import type { CoverageRow, ReportFormat } from '@/types/report.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import ExportButtons from '@/components/ui/ExportButtons.vue'

const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

const { data, isLoading, isError, refetch } = useCoverageReport()

const rows = computed<CoverageRow[]>(() => data.value ?? [])

// KPIs globales (suma de todas las zonas).
const totalFamilies = computed(() => rows.value.reduce((s, r) => s + Number(r.total_families), 0))
const totalCovered = computed(() => rows.value.reduce((s, r) => s + Number(r.covered), 0))
const globalCoveragePct = computed(() =>
  totalFamilies.value > 0 ? Math.round((totalCovered.value / totalFamilies.value) * 100) : 0,
)

// Exportación vía ?format (descarga blob). Estado para deshabilitar mientras descarga.
const exporting = ref(false)
async function onExport(format: ReportFormat) {
  if (exporting.value) return
  exporting.value = true
  try {
    await reportsApi.exportCoverage(format)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo exportar el reporte.'))
  } finally {
    exporting.value = false
  }
}

const columns = [
  { key: 'zone_name', label: 'Zona' },
  { key: 'total_families', label: 'Familias', align: 'right' as const },
  { key: 'covered', label: 'Con cobertura', align: 'right' as const },
  { key: 'uncovered', label: 'Sin cobertura', align: 'right' as const },
  { key: 'coverage_pct', label: 'Cobertura', align: 'right' as const },
]
const asRow = (r: unknown) => r as CoverageRow
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Reporte de cobertura"
      crumb="Analítica y control"
      subtitle="Porcentaje de familias con ayuda vigente por zona (HU-28)"
    >
      <template #actions>
        <ExportButtons @export="onExport" />
      </template>
    </PageHeader>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el reporte de cobertura.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga -->
    <template v-else-if="isLoading">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonBlock v-for="n in 3" :key="n" height="116px" />
      </div>
      <SkeletonBlock height="320px" />
    </template>

    <template v-else>
      <!-- KPIs globales -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Familias totales" :value="fmt(totalFamilies)">
          <template #icon><Users /></template>
        </KpiCard>
        <KpiCard label="Con cobertura vigente" :value="fmt(totalCovered)" tone="accent">
          <template #icon><ShieldCheck /></template>
        </KpiCard>
        <KpiCard label="Cobertura global" :value="`${globalCoveragePct}%`" tone="primary">
          <template #icon><ChartColumn /></template>
        </KpiCard>
      </div>

      <EmptyState
        v-if="rows.length === 0"
        title="Sin zonas registradas"
        message="No hay zonas para calcular la cobertura."
      >
        <template #icon><MapPin /></template>
      </EmptyState>

      <template v-else>
        <!-- Desglose por zona (barras CSS) -->
        <div class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
          <p class="mb-4 text-sm font-medium text-neutral-700">Cobertura por zona</p>
          <div class="space-y-3">
            <div
              v-for="r in rows"
              :key="r.zone_id"
              class="grid grid-cols-[160px_1fr] items-center gap-3"
            >
              <span class="truncate text-sm text-neutral-700">{{ r.zone_name }}</span>
              <ProgressBar :value="Number(r.coverage_pct)" label="" />
            </div>
          </div>
        </div>

        <!-- Tabla detallada -->
        <DataTable :columns="columns" :rows="rows" row-key="zone_id" min-width="720px">
          <template #total_families="{ row }">{{ fmt(asRow(row).total_families) }}</template>
          <template #covered="{ row }">{{ fmt(asRow(row).covered) }}</template>
          <template #uncovered="{ row }">
            <span :class="asRow(row).uncovered > 0 ? 'font-semibold text-danger' : ''">
              {{ fmt(asRow(row).uncovered) }}
            </span>
          </template>
          <template #coverage_pct="{ row }">
            <span class="font-semibold text-neutral-900">{{ fmt(asRow(row).coverage_pct) }}%</span>
          </template>
        </DataTable>
      </template>
    </template>
  </section>
</template>
