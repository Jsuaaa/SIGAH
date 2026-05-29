<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { FileText, FileSpreadsheet, Search, LayoutDashboard } from '@lucide/vue'
import { reportsApi } from '@/api/reports.api'
import { useCoverage, useDeliveriesByZone, useDonationsByType, useTraceability } from '@/composables/useReports'
import { DONOR_TYPE_LABELS } from '@/types/donor.types'
import type { DonorType } from '@/types/donor.types'
import type { ExportFormat } from '@/types/reports.types'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FormField from '@/components/form/FormField.vue'

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const money = (v: unknown) => num(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const { data: coverage, isLoading: loadingCov } = useCoverage()
const { data: byZone, isLoading: loadingZone } = useDeliveriesByZone()
const { data: byType, isLoading: loadingType } = useDonationsByType()

// --- Export -------------------------------------------------------------------
const exporting = ref<string | null>(null)
async function doExport(key: string, path: string, format: ExportFormat, filename: string, params: Record<string, unknown> = {}) {
  exporting.value = `${key}-${format}`
  try {
    await reportsApi.export(path, format, filename, params)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo exportar el reporte.'))
  } finally {
    exporting.value = null
  }
}

const covColumns = [
  { key: 'zone_name', label: 'Zona' },
  { key: 'total_families', label: 'Familias', align: 'right' as const },
  { key: 'families_with_coverage', label: 'Con cobertura', align: 'right' as const },
  { key: 'coverage_pct', label: 'Cobertura', align: 'right' as const },
]
const zoneColumns = [
  { key: 'zone_name', label: 'Zona' },
  { key: 'delivery_count', label: 'Entregas', align: 'right' as const },
  { key: 'total_weight_kg', label: 'Peso (kg)', align: 'right' as const },
  { key: 'families_attended', label: 'Familias', align: 'right' as const },
]
const typeColumns = [
  { key: 'donor_type', label: 'Tipo de donante' },
  { key: 'donation_count', label: 'Donaciones', align: 'right' as const },
  { key: 'total_weight_kg', label: 'Peso (kg)', align: 'right' as const },
  { key: 'total_monetary_amount', label: 'Monto', align: 'right' as const },
]
const asAny = (r: unknown) => r as Record<string, unknown>

// --- Trazabilidad (HU-29) -----------------------------------------------------
const donationIdInput = ref('')
const donationId = ref(0)
function trace() {
  const n = Number(donationIdInput.value)
  if (!Number.isInteger(n) || n < 1) {
    toast.error('Ingresa un ID de donación válido.')
    return
  }
  donationId.value = n
}
const { data: traceData, isLoading: loadingTrace, isError: traceError, error: traceErr } = useTraceability(donationId)
const traceNotFound = computed(() => traceError.value && apiErrorStatus(traceErr.value) === 404)
</script>

<template>
  <section class="space-y-6">
    <PageHeader title="Reportes" crumb="Análisis" subtitle="Indicadores y exportación (HU-28/29)">
      <template #actions>
        <AppButton variant="outline" size="sm" :disabled="exporting === 'dash-pdf'" @click="doExport('dash', '/reports/dashboard', 'pdf', 'dashboard.pdf')">
          <LayoutDashboard /> Dashboard PDF
        </AppButton>
        <AppButton variant="outline" size="sm" :disabled="exporting === 'dash-xlsx'" @click="doExport('dash', '/reports/dashboard', 'xlsx', 'dashboard.xlsx')">
          <FileSpreadsheet /> Dashboard Excel
        </AppButton>
      </template>
    </PageHeader>

    <!-- Cobertura por zona -->
    <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 class="text-sm font-semibold text-neutral-700">Cobertura por zona</h2>
      <div v-if="loadingCov" class="space-y-2"><SkeletonBlock v-for="n in 3" :key="n" height="36px" /></div>
      <DataTable v-else :columns="covColumns" :rows="coverage ?? []" row-key="zone_id" min-width="560px">
        <template #coverage_pct="{ row }"><span class="font-mono">{{ Math.round(num(asAny(row).coverage_pct)) }}%</span></template>
        <template #empty><p class="py-4 text-center text-sm text-neutral-500">Sin datos.</p></template>
      </DataTable>
    </div>

    <!-- Entregas por zona -->
    <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-neutral-700">Entregas por zona</h2>
        <div class="flex gap-2">
          <AppButton variant="outline" size="sm" :disabled="exporting === 'zone-pdf'" @click="doExport('zone', '/reports/deliveries-by-zone', 'pdf', 'entregas-por-zona.pdf')"><FileText /> PDF</AppButton>
          <AppButton variant="outline" size="sm" :disabled="exporting === 'zone-xlsx'" @click="doExport('zone', '/reports/deliveries-by-zone', 'xlsx', 'entregas-por-zona.xlsx')"><FileSpreadsheet /> Excel</AppButton>
        </div>
      </div>
      <div v-if="loadingZone" class="space-y-2"><SkeletonBlock v-for="n in 3" :key="n" height="36px" /></div>
      <DataTable v-else :columns="zoneColumns" :rows="byZone ?? []" row-key="zone_id" min-width="560px">
        <template #total_weight_kg="{ row }"><span class="font-mono">{{ Math.round(num(asAny(row).total_weight_kg)).toLocaleString('es-CO') }}</span></template>
        <template #empty><p class="py-4 text-center text-sm text-neutral-500">Sin datos.</p></template>
      </DataTable>
    </div>

    <!-- Donaciones por tipo -->
    <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-neutral-700">Donaciones por tipo de donante</h2>
        <div class="flex gap-2">
          <AppButton variant="outline" size="sm" :disabled="exporting === 'type-pdf'" @click="doExport('type', '/reports/donations-by-type', 'pdf', 'donaciones-por-tipo.pdf')"><FileText /> PDF</AppButton>
          <AppButton variant="outline" size="sm" :disabled="exporting === 'type-xlsx'" @click="doExport('type', '/reports/donations-by-type', 'xlsx', 'donaciones-por-tipo.xlsx')"><FileSpreadsheet /> Excel</AppButton>
        </div>
      </div>
      <div v-if="loadingType" class="space-y-2"><SkeletonBlock v-for="n in 3" :key="n" height="36px" /></div>
      <DataTable v-else :columns="typeColumns" :rows="byType ?? []" row-key="donor_type" min-width="560px">
        <template #donor_type="{ row }">{{ DONOR_TYPE_LABELS[asAny(row).donor_type as DonorType] ?? asAny(row).donor_type }}</template>
        <template #total_weight_kg="{ row }"><span class="font-mono">{{ Math.round(num(asAny(row).total_weight_kg)).toLocaleString('es-CO') }}</span></template>
        <template #total_monetary_amount="{ row }"><span class="font-mono">{{ money(asAny(row).total_monetary_amount) }}</span></template>
        <template #empty><p class="py-4 text-center text-sm text-neutral-500">Sin datos.</p></template>
      </DataTable>
    </div>

    <!-- Trazabilidad -->
    <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 class="text-sm font-semibold text-neutral-700">Trazabilidad donante → entrega → familia (HU-29)</h2>
      <form class="flex items-end gap-3" @submit.prevent="trace">
        <div class="w-48">
          <FormField label="ID de donación" input-id="tr-id">
            <input id="tr-id" v-model="donationIdInput" type="number" min="1" class="control" placeholder="Ej. 12" />
          </FormField>
        </div>
        <AppButton type="submit"><Search /> Trazar</AppButton>
        <template v-if="donationId > 0 && traceData?.donations?.length">
          <AppButton variant="outline" :disabled="exporting === 'trace-pdf'" @click="doExport('trace', '/reports/traceability', 'pdf', 'trazabilidad.pdf', { donation_id: donationId })"><FileText /> PDF</AppButton>
          <AppButton variant="outline" :disabled="exporting === 'trace-xlsx'" @click="doExport('trace', '/reports/traceability', 'xlsx', 'trazabilidad.xlsx', { donation_id: donationId })"><FileSpreadsheet /> Excel</AppButton>
        </template>
      </form>

      <div v-if="donationId > 0">
        <div v-if="loadingTrace" class="space-y-2"><SkeletonBlock height="80px" /></div>
        <p v-else-if="traceNotFound" class="text-sm text-neutral-500">No se encontró la donación #{{ donationId }}.</p>
        <p v-else-if="traceError" class="text-sm text-danger">No se pudo cargar la trazabilidad.</p>
        <div v-else-if="traceData" class="space-y-4">
          <div v-for="don in traceData.donations" :key="don.donation_code" class="rounded-md border border-neutral-200 p-4">
            <p class="text-sm">
              <span class="font-mono font-semibold text-neutral-900">{{ don.donation_code }}</span>
              · {{ don.donor.name }} ({{ DONOR_TYPE_LABELS[don.donor.type as DonorType] ?? don.donor.type }})
              → bodega <strong>{{ don.warehouse.name }}</strong>
            </p>
            <ul v-if="don.deliveries.length" class="mt-2 space-y-1 border-l-2 border-primary-200 pl-3 text-sm text-neutral-600">
              <li v-for="del in don.deliveries" :key="del.delivery_code">
                <span class="font-mono">{{ del.delivery_code }}</span> → familia
                <strong>{{ del.family.family_code }}</strong> ({{ del.family.num_members }} miembros) ·
                {{ del.coverage_days }} días · {{ del.status }}
              </li>
            </ul>
            <p v-else class="mt-2 text-xs text-neutral-400">Sin entregas asociadas todavía.</p>
          </div>
          <p v-if="!traceData.donations.length" class="text-sm text-neutral-500">Sin resultados de trazabilidad.</p>
        </div>
      </div>
      <p v-else class="text-sm text-neutral-400">Ingresa el ID de una donación para ver su cadena de trazabilidad.</p>
    </div>
  </section>
</template>
