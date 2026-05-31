<script setup lang="ts">
/**
 * Dashboard principal (HU-27).
 * KPIs reales de /reports/dashboard, gráficos de barras (CSS) de entregas por
 * zona y donaciones por tipo, ocupación de refugios y alertas de inventario
 * activas (reutiliza useStockAlerts). Los KPIs son clicables y navegan a su
 * listado. Las consultas se cargan en paralelo (vue-query) con skeletons.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Users,
  PackageCheck,
  Clock,
  Truck,
  Bell,
  Home,
  RotateCcw,
  ChartColumn,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardMetrics, useDeliveriesByZone, useDonationsByType } from '@/composables/useReports'
import { useStockAlerts } from '@/composables/useAlerts'
import { DONOR_TYPE_LABELS } from '@/types/donor.types'
import type { DonorType } from '@/types/donor.types'
import { SEVERITY_BADGE, SEVERITY_LABELS } from '@/types/alert.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

const { data: metrics, isLoading: metricsLoading, isError: metricsError, refetch } = useDashboardMetrics()
const { data: deliveriesByZone, isLoading: dzLoading } = useDeliveriesByZone()
const { data: donationsByType, isLoading: dtLoading } = useDonationsByType()
const { data: alerts, isLoading: alertsLoading } = useStockAlerts()

// Cobertura = familias con cobertura vigente / familias activas (HU-28 CA1).
const coveragePct = computed(() => {
  const active = metrics.value?.total_active_families ?? 0
  const covered = metrics.value?.families_covered ?? 0
  if (active <= 0) return 0
  return Math.round((covered / active) * 100)
})

// KPIs clicables: cada uno navega a su listado.
const kpis = computed(() => {
  const m = metrics.value
  return [
    { label: 'Familias registradas', value: fmt(m?.total_families ?? 0), tone: 'primary' as const, icon: Users, to: '/families' },
    { label: 'Familias atendidas', value: fmt(m?.families_covered ?? 0), tone: 'accent' as const, icon: PackageCheck, to: '/families', delta: `${coveragePct.value}% cobertura` },
    { label: 'Familias pendientes', value: fmt(m?.families_uncovered ?? 0), tone: 'danger' as const, icon: Clock, to: '/reports/unattended' },
    { label: 'Entregas hoy', value: fmt(m?.total_deliveries_today ?? 0), tone: 'accent' as const, icon: Truck, to: '/deliveries' },
    { label: 'Alertas activas', value: fmt(m?.low_stock_count ?? 0), tone: 'warning' as const, icon: Bell, to: '/inventory/alerts' },
    { label: 'Refugios ocupados', value: `${fmt(m?.occupied_shelters_pct ?? 0)}%`, tone: 'primary' as const, icon: Home, to: '/shelters' },
  ]
})

// Máximos para escalar las barras CSS.
const maxDeliveries = computed(() =>
  Math.max(1, ...(deliveriesByZone.value ?? []).map((d) => Number(d.delivery_count) || 0)),
)
const maxDonations = computed(() =>
  Math.max(1, ...(donationsByType.value ?? []).map((d) => Number(d.total_weight_kg) || 0)),
)
const barPct = (value: number, max: number) => (max > 0 ? (value / max) * 100 : 0)

// Entregas recientes: top de zonas con más entregas (proxy de "actividad reciente").
const topDeliveryZones = computed(() => (deliveriesByZone.value ?? []).slice(0, 6))
const topAlerts = computed(() => (alerts.value ?? []).slice(0, 5))

function donorLabel(type: string) {
  return DONOR_TYPE_LABELS[type as DonorType] ?? type
}
function go(to: string) {
  router.push(to)
}
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Panel de control"
      :crumb="`Bienvenido, ${auth.user?.name ?? 'usuario'}`"
      subtitle="Resumen general del sistema (HU-27)"
    />

    <!-- Error de las métricas principales -->
    <div v-if="metricsError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el panel.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <template v-else>
      <!-- KPIs clicables -->
      <div v-if="metricsLoading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SkeletonBlock v-for="n in 6" :key="n" height="132px" />
      </div>
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <button
          v-for="kpi in kpis"
          :key="kpi.label"
          type="button"
          class="rounded-lg text-left transition-shadow hover:shadow-md focus:ring-2 focus:ring-primary-400 focus:outline-none"
          @click="go(kpi.to)"
        >
          <KpiCard :label="kpi.label" :value="kpi.value" :tone="kpi.tone" :delta="kpi.delta">
            <template #icon><component :is="kpi.icon" /></template>
          </KpiCard>
        </button>
      </div>

      <!-- Ocupación de refugios -->
      <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
        <h3 class="text-base font-semibold text-neutral-900">Ocupación de refugios</h3>
        <ProgressBar
          label="Capacidad ocupada"
          :value="metrics?.occupied_shelters_pct ?? 0"
          :ok="0"
          :warn="0"
          invert
        />
      </div>

      <!-- Gráficos de barras (CSS) -->
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Entregas por zona -->
        <section class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
          <h3 class="mb-4 text-base font-semibold text-neutral-900">Entregas por zona</h3>
          <div v-if="dzLoading" class="space-y-3">
            <SkeletonBlock v-for="n in 4" :key="n" height="32px" />
          </div>
          <EmptyState v-else-if="topDeliveryZones.length === 0" title="Sin entregas registradas">
            <template #icon><ChartColumn /></template>
          </EmptyState>
          <div v-else class="space-y-3">
            <div
              v-for="d in topDeliveryZones"
              :key="d.zone_id"
              class="grid grid-cols-[120px_1fr_auto] items-center gap-3"
            >
              <span class="truncate text-sm text-neutral-700">{{ d.zone_name }}</span>
              <ProgressBar :value="barPct(Number(d.delivery_count), maxDeliveries)" :ok="0" :warn="0" />
              <span class="w-12 text-right font-mono text-xs font-semibold text-neutral-900">
                {{ fmt(d.delivery_count) }}
              </span>
            </div>
          </div>
        </section>

        <!-- Donaciones por tipo (peso kg) -->
        <section class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
          <h3 class="mb-4 text-base font-semibold text-neutral-900">Donaciones por tipo (kg)</h3>
          <div v-if="dtLoading" class="space-y-3">
            <SkeletonBlock v-for="n in 4" :key="n" height="32px" />
          </div>
          <EmptyState v-else-if="(donationsByType ?? []).length === 0" title="Sin donaciones registradas">
            <template #icon><ChartColumn /></template>
          </EmptyState>
          <div v-else class="space-y-3">
            <div
              v-for="d in donationsByType"
              :key="d.donor_type"
              class="grid grid-cols-[120px_1fr_auto] items-center gap-3"
            >
              <span class="truncate text-sm text-neutral-700">{{ donorLabel(d.donor_type) }}</span>
              <ProgressBar :value="barPct(Number(d.total_weight_kg), maxDonations)" :ok="0" :warn="0" />
              <span class="w-16 text-right font-mono text-xs font-semibold text-neutral-900">
                {{ fmt(d.total_weight_kg) }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <!-- Alertas de inventario activas -->
      <section class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-neutral-900">Alertas de inventario</h3>
          <AppButton variant="ghost" size="sm" @click="go('/inventory/alerts')">Ver todas</AppButton>
        </div>
        <div v-if="alertsLoading" class="space-y-2">
          <SkeletonBlock v-for="n in 3" :key="n" height="40px" />
        </div>
        <EmptyState v-else-if="topAlerts.length === 0" title="Sin alertas activas">
          <template #icon><Bell /></template>
        </EmptyState>
        <ul v-else class="divide-y divide-neutral-100">
          <li v-for="(a, i) in topAlerts" :key="i" class="flex items-center justify-between gap-3 py-2.5">
            <span class="min-w-0 truncate text-sm text-neutral-800">{{ a.message }}</span>
            <span
              :class="[
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                SEVERITY_BADGE[a.severity],
              ]"
            >
              {{ SEVERITY_LABELS[a.severity] }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
