<script setup lang="ts">
/**
 * HU-30 — Zonas sin entregas (tabla/reporte).
 * Lista las zonas que NO registran ninguna entrega, con su población estimada y
 * su número de familias censadas. El resaltado en el mapa lo cubre la épica Mapa.
 *
 * DESVIACIÓN DOCUMENTADA: el backend NO expone /reports/zones-without-deliveries
 * (no existe la ruta ni el SP). El listado se DERIVA en el cliente cruzando
 * GET /reports/deliveries-by-zone (zonas con entregas) con el catálogo de zonas
 * (población) y GET /reports/coverage (familias por zona) — ver useReports.ts.
 *
 * Como no hay endpoint con ?format=pdf|xlsx para este reporte derivado y no se
 * pueden instalar dependencias, la exportación se hace a CSV en el cliente
 * (blob + URL.createObjectURL, sin file-saver).
 */
import { computed } from 'vue'
import { RotateCcw, MapPin, Download, PackageX } from '@lucide/vue'
import { useZonesWithoutDeliveries } from '@/composables/useReports'
import type { ZoneWithoutDeliveries } from '@/types/report.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

const { data, isLoading, isError, refetch } = useZonesWithoutDeliveries()

const rows = computed<ZoneWithoutDeliveries[]>(() => data.value ?? [])
const totalPopulation = computed(() => rows.value.reduce((s, r) => s + Number(r.estimated_population || 0), 0))

const columns = [
  { key: 'zone_name', label: 'Zona' },
  { key: 'estimated_population', label: 'Población', align: 'right' as const },
  { key: 'total_families', label: 'Familias censadas', align: 'right' as const },
]
const asRow = (r: unknown) => r as ZoneWithoutDeliveries

// Exportación CSV en el cliente (sin endpoint ?format para este reporte derivado).
function exportCsv() {
  if (rows.value.length === 0) return
  const header = ['Zona', 'Poblacion', 'Familias censadas']
  const lines = rows.value.map((r) =>
    [r.zone_name, r.estimated_population ?? 0, r.total_families].map(csvCell).join(','),
  )
  const csv = [header.join(','), ...lines].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'zonas-sin-entregas.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Zonas sin entregas"
      crumb="Analítica y control"
      :subtitle="rows.length ? `${rows.length} zonas sin ninguna entrega` : 'Zonas que aún no reciben ayuda (HU-30)'"
    >
      <template #actions>
        <AppButton variant="outline" size="sm" :disabled="rows.length === 0" @click="exportCsv">
          <Download /> Exportar CSV
        </AppButton>
      </template>
    </PageHeader>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo construir el reporte de zonas sin entregas.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="refetch">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga -->
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <DataTable :columns="columns" :rows="rows" row-key="zone_id" min-width="560px">
        <template #zone_name="{ row }">
          <span class="font-medium text-neutral-900">{{ asRow(row).zone_name }}</span>
        </template>
        <template #estimated_population="{ row }">{{ fmt(asRow(row).estimated_population) }}</template>
        <template #total_families="{ row }">
          <span :class="asRow(row).total_families > 0 ? 'font-semibold text-warning' : ''">
            {{ fmt(asRow(row).total_families) }}
          </span>
        </template>

        <template #empty>
          <EmptyState
            title="Todas las zonas tienen entregas"
            message="No hay zonas sin actividad de entrega registrada."
          >
            <template #icon><MapPin /></template>
          </EmptyState>
        </template>

        <template v-if="rows.length" #footer>
          <span class="flex items-center gap-2 text-neutral-600">
            <PackageX class="h-4 w-4" />
            {{ rows.length }} zonas · población estimada total {{ fmt(totalPopulation) }}
          </span>
        </template>
      </DataTable>
    </template>
  </section>
</template>
