<script setup lang="ts">
/**
 * HU-29 — Reporte de trazabilidad.
 * Vista encadenada/jerárquica de la cadena de suministro:
 *   donación + donante → bodega → entrega → familia.
 * Exportación PDF/Excel vía ?format (ExportButtons).
 *
 * IMPORTANTE: el backend (GET /reports/traceability) EXIGE donation_id O
 * resource_type_id (si faltan ambos responde 400). NO acepta filtros de donante
 * ni de zona; los filtros reales son: resource_type_id, donation_id, from, to.
 * Por eso la selección principal es "tipo de recurso" (o un id de donación
 * concreto), con rango de fechas opcional.
 */
import { computed, ref } from 'vue'
import {
  RotateCcw,
  Search,
  Filter,
  Package,
  Warehouse,
  Truck,
  Users,
  ChartColumn,
} from '@lucide/vue'
import { useTraceabilityReport } from '@/composables/useReports'
import { useAllResourceTypes } from '@/composables/useResourceTypes'
import { reportsApi } from '@/api/reports.api'
import { toast } from 'vue-sonner'
import { apiErrorMessage } from '@/utils/apiError'
import { DONOR_TYPE_LABELS } from '@/types/donor.types'
import type { DonorType } from '@/types/donor.types'
import type { TraceabilityFilters, ReportFormat } from '@/types/report.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SelectField from '@/components/form/SelectField.vue'
import InputField from '@/components/form/InputField.vue'
import ExportButtons from '@/components/ui/ExportButtons.vue'

const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

// --- Formulario de filtros (borrador) -> filtros aplicados ---
const resourceTypeId = ref('')
const donationId = ref('')
const from = ref('')
const to = ref('')

// Filtros realmente aplicados (la query se ejecuta cuando hay uno de los dos ids).
const applied = ref<TraceabilityFilters>({})

const { data: resourceTypes } = useAllResourceTypes()
const resourceOptions = computed(() => [
  { value: '', label: 'Selecciona un tipo de recurso…' },
  ...(resourceTypes.value ?? []).map((r) => ({ value: String(r.id), label: r.name })),
])

const appliedRef = computed(() => applied.value)
const { data, isLoading, isFetching, isError, refetch } = useTraceabilityReport(appliedRef)

const donations = computed(() => data.value?.donations ?? [])
const hasQuery = computed(
  () => applied.value.donation_id !== undefined || applied.value.resource_type_id !== undefined,
)

function donorLabel(type: string) {
  return DONOR_TYPE_LABELS[type as DonorType] ?? type
}

function applyFilters() {
  applied.value = {
    ...(resourceTypeId.value ? { resource_type_id: Number(resourceTypeId.value) } : {}),
    ...(donationId.value ? { donation_id: Number(donationId.value) } : {}),
    ...(from.value ? { from: from.value } : {}),
    ...(to.value ? { to: to.value } : {}),
  }
}

const exporting = ref(false)
async function onExport(format: ReportFormat) {
  if (!hasQuery.value) {
    toast.error('Aplica un filtro (tipo de recurso o donación) antes de exportar.')
    return
  }
  if (exporting.value) return
  exporting.value = true
  try {
    await reportsApi.exportTraceability(format, applied.value)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo exportar el reporte.'))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Trazabilidad"
      crumb="Analítica y control"
      subtitle="Cadena donante → bodega → entrega → familia (HU-29)"
    >
      <template #actions>
        <ExportButtons @export="onExport" />
      </template>
    </PageHeader>

    <!-- Filtros: se requiere tipo de recurso O id de donación (RN del backend) -->
    <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <SelectField v-model="resourceTypeId" label="Tipo de recurso" :options="resourceOptions" />
        <InputField v-model="donationId" label="ID de donación" type="number" placeholder="Opcional" />
        <InputField v-model="from" label="Desde" type="date" />
        <InputField v-model="to" label="Hasta" type="date" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-neutral-500">
          Indica un tipo de recurso o un ID de donación para trazar la cadena.
        </p>
        <AppButton size="sm" @click="applyFilters"><Search /> Consultar</AppButton>
      </div>
    </div>

    <!-- Estado inicial: sin filtro aplicado -->
    <EmptyState
      v-if="!hasQuery"
      title="Selecciona un filtro"
      message="Elige un tipo de recurso o un ID de donación y pulsa Consultar para ver la trazabilidad."
    >
      <template #icon><Filter /></template>
    </EmptyState>

    <!-- Error -->
    <div v-else-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la trazabilidad.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga -->
    <div v-else-if="isLoading" class="space-y-3">
      <SkeletonBlock v-for="n in 3" :key="n" height="160px" />
    </div>

    <!-- Sin resultados para el filtro -->
    <EmptyState
      v-else-if="donations.length === 0"
      title="Sin resultados"
      message="No hay donaciones que coincidan con el filtro seleccionado."
    >
      <template #icon><ChartColumn /></template>
    </EmptyState>

    <!-- Cadena jerárquica -->
    <div v-else class="space-y-5" :class="{ 'opacity-60 transition-opacity': isFetching }">
      <article
        v-for="don in donations"
        :key="don.donation_id"
        class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
      >
        <!-- Nivel 1: Donación + Donante -->
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
          <div class="flex items-center gap-3">
            <span class="grid h-9 w-9 place-items-center rounded-md bg-primary-50 text-primary-600 [&>svg]:h-5 [&>svg]:w-5">
              <Package />
            </span>
            <div>
              <p class="font-semibold text-neutral-900">
                {{ don.donor.name }}
                <span class="ml-1 text-xs font-normal text-neutral-500">({{ donorLabel(don.donor.type) }})</span>
              </p>
              <p class="font-mono text-xs text-neutral-500">{{ don.donation_code }} · {{ don.donation_date }}</p>
            </div>
          </div>
          <span
            v-if="don.monetary_amount"
            class="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-600"
          >
            $ {{ fmt(don.monetary_amount) }}
          </span>
        </header>

        <div class="space-y-4 px-5 py-4">
          <!-- Nivel 2: Bodega destino -->
          <div class="flex items-center gap-2 text-sm text-neutral-700">
            <Warehouse class="h-4 w-4 text-neutral-400" />
            <span class="font-medium">Bodega:</span>
            <span>{{ don.warehouse.name }}</span>
            <span class="text-neutral-400">·</span>
            <span class="text-neutral-500">{{ don.warehouse.address }}</span>
          </div>

          <!-- Recursos donados -->
          <div v-if="don.details.length" class="flex flex-wrap gap-2 pl-6">
            <span
              v-for="d in don.details"
              :key="d.resource_type_id"
              class="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600"
            >
              {{ d.resource_type_name }}: <strong>{{ fmt(d.quantity) }}</strong>
              <span class="text-neutral-400"> · {{ fmt(d.weight_kg) }} kg</span>
            </span>
          </div>

          <!-- Nivel 3 y 4: Entregas → Familia -->
          <div class="border-l-2 border-neutral-100 pl-6">
            <p class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              <Truck class="h-4 w-4" /> Entregas derivadas
            </p>

            <p v-if="don.deliveries.length === 0" class="text-sm text-neutral-400">
              Esta donación aún no ha derivado en entregas.
            </p>

            <ul v-else class="space-y-3">
              <li
                v-for="del in don.deliveries"
                :key="del.delivery_id"
                class="rounded-md border border-neutral-200 p-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-mono text-xs text-neutral-500">{{ del.delivery_code }}</span>
                    <StatusBadge :status="del.status as 'ENTREGADA' | 'PROGRAMADA' | 'EN_CURSO'" />
                  </div>
                  <span class="text-xs text-neutral-500">{{ del.delivery_date }}</span>
                </div>

                <!-- Nivel 4: Familia destino -->
                <div class="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                  <Users class="h-4 w-4 text-neutral-400" />
                  <span class="font-medium">Familia</span>
                  <span class="font-mono text-xs text-neutral-500">{{ del.family.family_code }}</span>
                  <span class="text-neutral-400">·</span>
                  <span class="text-neutral-500">{{ fmt(del.family.num_members) }} miembros</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
