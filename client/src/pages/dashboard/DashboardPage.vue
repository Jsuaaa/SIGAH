<script setup lang="ts">
import { Users, PackageCheck, Clock, Boxes, Bell, Gauge, TrendingUp, TrendingDown } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const auth = useAuthStore()
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Dashboard"
      :crumb="`Bienvenido, ${auth.user?.name ?? 'usuario'}`"
      subtitle="Panel de indicadores (HU-27) · datos de ejemplo hasta conectar /reports/dashboard"
    />

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard label="Familias registradas" value="4.812" tone="primary" delta="+312 esta semana" trend="up">
        <template #icon><Users /></template>
        <template #delta-icon><TrendingUp class="h-4 w-4" /></template>
      </KpiCard>
      <KpiCard label="Familias atendidas" value="3.106" tone="accent" delta="64% cobertura" trend="up">
        <template #icon><PackageCheck /></template>
        <template #delta-icon><TrendingUp class="h-4 w-4" /></template>
      </KpiCard>
      <KpiCard label="Pendientes" value="1.706" tone="danger" delta="por atender" trend="down">
        <template #icon><Clock /></template>
        <template #delta-icon><TrendingDown class="h-4 w-4" /></template>
      </KpiCard>
      <KpiCard label="Entregas hoy" value="186" tone="accent" delta="+18% vs. ayer" trend="up">
        <template #icon><PackageCheck /></template>
        <template #delta-icon><TrendingUp class="h-4 w-4" /></template>
      </KpiCard>
      <KpiCard label="Peso almacenado" value="14,2 t" tone="primary">
        <template #icon><Boxes /></template>
      </KpiCard>
      <KpiCard label="Alertas activas" value="3" tone="warning" delta="revisar inventario" trend="down">
        <template #icon><Bell /></template>
        <template #delta-icon><Gauge class="h-4 w-4" /></template>
      </KpiCard>
    </div>

    <div class="space-y-5 rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
      <h3 class="text-base font-semibold text-neutral-900">Cobertura de víveres por zona</h3>
      <ProgressBar label="Zona Norte" :value="82" />
      <ProgressBar label="Centro" :value="54" />
      <ProgressBar label="Cantaclaro" :value="21" />
    </div>
  </section>
</template>
