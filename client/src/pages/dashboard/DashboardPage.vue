<script setup lang="ts">
import { computed } from 'vue'
import '@/lib/chartSetup'
import { Bar, Pie } from 'vue-chartjs'
import { Users, PackageCheck, Clock, Truck, Bell, Activity } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboard, useCoverage, useDeliveriesByZone, useDonationsByType } from '@/composables/useReports'
import { DONOR_TYPE_LABELS } from '@/types/donor.types'
import type { DonorType } from '@/types/donor.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const auth = useAuthStore()
const { data: metrics, isLoading } = useDashboard()
const { data: coverage } = useCoverage()
const { data: deliveriesByZone } = useDeliveriesByZone()
const { data: donationsByType } = useDonationsByType()

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const m = computed(() => metrics.value)
const coveragePct = computed(() => {
  const t = num(m.value?.total_families)
  return t > 0 ? Math.round((num(m.value?.families_covered) / t) * 100) : 0
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
}
const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const } } }

const coverageChart = computed(() => ({
  labels: (coverage.value ?? []).map((c) => c.zone_name),
  datasets: [{ label: 'Cobertura %', data: (coverage.value ?? []).map((c) => num(c.coverage_pct)), backgroundColor: '#1e5ba8' }],
}))
const deliveriesChart = computed(() => ({
  labels: (deliveriesByZone.value ?? []).map((d) => d.zone_name),
  datasets: [{ label: 'Entregas', data: (deliveriesByZone.value ?? []).map((d) => num(d.delivery_count)), backgroundColor: '#0e7c66' }],
}))
const donationsChart = computed(() => ({
  labels: (donationsByType.value ?? []).map((d) => DONOR_TYPE_LABELS[d.donor_type as DonorType] ?? d.donor_type),
  datasets: [{
    data: (donationsByType.value ?? []).map((d) => num(d.donation_count)),
    backgroundColor: ['#1e5ba8', '#0e7c66', '#c2410c', '#7c3aed', '#eab308'],
  }],
}))
const hasDonations = computed(() => (donationsByType.value ?? []).length > 0)
</script>

<template>
  <section class="space-y-6">
    <PageHeader title="Dashboard" :crumb="`Bienvenido, ${auth.user?.name ?? 'usuario'}`" subtitle="Panel de indicadores (HU-27)" />

    <div v-if="isLoading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <SkeletonBlock v-for="n in 6" :key="n" height="120px" />
    </div>
    <template v-else>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Familias" :value="num(m?.total_families).toLocaleString('es-CO')" tone="primary"><template #icon><Users /></template></KpiCard>
        <KpiCard label="Con cobertura" :value="num(m?.families_covered).toLocaleString('es-CO')" :delta="`${coveragePct}% cobertura`" trend="up" tone="accent"><template #icon><PackageCheck /></template></KpiCard>
        <KpiCard label="Sin cobertura" :value="num(m?.families_uncovered).toLocaleString('es-CO')" :tone="num(m?.families_uncovered) > 0 ? 'danger' : 'accent'"><template #icon><Clock /></template></KpiCard>
        <KpiCard label="Entregas hoy" :value="num(m?.total_deliveries_today).toLocaleString('es-CO')" :delta="`${num(m?.total_deliveries_week)} en la semana`" tone="accent"><template #icon><Truck /></template></KpiCard>
        <KpiCard label="Stock bajo" :value="num(m?.low_stock_count)" :tone="num(m?.low_stock_count) > 0 ? 'warning' : 'accent'"><template #icon><Bell /></template></KpiCard>
        <KpiCard label="Vectores activos" :value="num(m?.active_health_vectors)" :tone="num(m?.active_health_vectors) > 0 ? 'warning' : 'accent'"><template #icon><Activity /></template></KpiCard>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div class="rounded-lg border border-neutral-200 bg-white p-5 lg:col-span-2">
          <h3 class="mb-4 text-sm font-semibold text-neutral-700">Cobertura por zona (%)</h3>
          <div style="height: 260px"><Bar :data="coverageChart" :options="chartOptions" /></div>
        </div>
        <div class="rounded-lg border border-neutral-200 bg-white p-5">
          <h3 class="mb-4 text-sm font-semibold text-neutral-700">Donaciones por tipo</h3>
          <div v-if="hasDonations" style="height: 260px"><Pie :data="donationsChart" :options="pieOptions" /></div>
          <p v-else class="py-10 text-center text-sm text-neutral-400">Sin donaciones registradas.</p>
        </div>
        <div class="rounded-lg border border-neutral-200 bg-white p-5 lg:col-span-3">
          <h3 class="mb-4 text-sm font-semibold text-neutral-700">Entregas por zona</h3>
          <div style="height: 240px"><Bar :data="deliveriesChart" :options="chartOptions" /></div>
        </div>
      </div>
    </template>
  </section>
</template>
