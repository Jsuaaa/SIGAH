<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ShieldCheck, RotateCcw, PackageX, CalendarClock, CalendarX, TriangleAlert, ChevronRight,
} from '@lucide/vue'
import type { Component } from 'vue'
import { useInventoryAlerts } from '@/composables/useInventory'
import { ALERT_KIND_LABELS, ALERT_SEVERITY_LABELS } from '@/types/inventory.types'
import type { AlertKind, AlertSeverity, InventoryAlert } from '@/types/inventory.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const router = useRouter()
const { data, isLoading, isError, refetch } = useInventoryAlerts()

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 }
const SEVERITY_CLASSES: Record<AlertSeverity, string> = {
  CRITICAL: 'border-l-danger bg-danger-bg',
  HIGH: 'border-l-risk-high bg-risk-high-bg',
  MEDIUM: 'border-l-warning bg-warning-bg',
}
const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-risk-high text-white',
  MEDIUM: 'bg-warning text-white',
}
const KIND_ICON: Record<AlertKind, Component> = {
  LOW_STOCK: PackageX,
  EXPIRING_SOON: CalendarClock,
  EXPIRED: CalendarX,
  WAREHOUSE_OVER_85: TriangleAlert,
}

const alerts = computed(() =>
  [...(data.value ?? [])].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
)
const counts = computed(() => {
  const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 } as Record<AlertSeverity, number>
  for (const a of alerts.value) c[a.severity]++
  return c
})

function goTo(alert: InventoryAlert) {
  if (alert.link && alert.link.startsWith('/')) router.push(alert.link)
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Alertas de inventario"
      crumb="Logística"
      :subtitle="alerts.length ? `${alerts.length} alerta(s) activa(s)` : 'Stock bajo, vencimientos y capacidad'"
    >
      <template #actions>
        <AppButton variant="outline" size="sm" @click="() => refetch()"><RotateCcw /> Actualizar</AppButton>
      </template>
    </PageHeader>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las alertas.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-3">
      <SkeletonBlock v-for="n in 4" :key="n" height="72px" />
    </div>

    <div v-else-if="!alerts.length" class="rounded-lg border border-success-br bg-success-bg">
      <EmptyState title="Todo en orden" message="No hay alertas de inventario activas en este momento.">
        <template #icon><ShieldCheck /></template>
      </EmptyState>
    </div>

    <template v-else>
      <!-- Resumen por severidad -->
      <div class="flex flex-wrap gap-2 text-sm">
        <span v-if="counts.CRITICAL" class="rounded-full bg-danger px-3 py-1 font-semibold text-white">{{ counts.CRITICAL }} críticas</span>
        <span v-if="counts.HIGH" class="rounded-full bg-risk-high px-3 py-1 font-semibold text-white">{{ counts.HIGH }} altas</span>
        <span v-if="counts.MEDIUM" class="rounded-full bg-warning px-3 py-1 font-semibold text-white">{{ counts.MEDIUM }} medias</span>
      </div>

      <ul class="space-y-3">
        <li
          v-for="(a, i) in alerts"
          :key="i"
          :class="['flex items-center gap-4 rounded-lg border border-neutral-200 border-l-4 bg-white p-4', SEVERITY_CLASSES[a.severity]]"
        >
          <span class="grid h-10 w-10 flex-none place-items-center rounded-full bg-white/70 text-neutral-700 [&>svg]:h-5 [&>svg]:w-5">
            <component :is="KIND_ICON[a.kind]" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span :class="['rounded-full px-2 py-0.5 text-xs font-semibold', SEVERITY_BADGE[a.severity]]">
                {{ ALERT_SEVERITY_LABELS[a.severity] }}
              </span>
              <span class="text-xs font-medium text-neutral-500">{{ ALERT_KIND_LABELS[a.kind] }}</span>
            </div>
            <p class="mt-1 text-sm text-neutral-800">{{ a.message }}</p>
          </div>
          <AppButton
            v-if="a.link && a.link.startsWith('/')"
            variant="ghost"
            size="sm"
            @click="goTo(a)"
          >
            Ver <ChevronRight />
          </AppButton>
        </li>
      </ul>
    </template>
  </section>
</template>
