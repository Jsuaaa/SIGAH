<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, MapPin, Users, SearchX } from '@lucide/vue'
import {
  useZone, useZoneFamilies, useZoneShelters, useZoneWarehouses,
} from '@/composables/useZones'
import { SHELTER_TYPE_LABELS } from '@/types/shelter.types'
import type { Family } from '@/types/family.types'
import type { ShelterWithOccupancy } from '@/types/shelter.types'
import type { ZoneWarehouse } from '@/types/zone.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import FamilyStatusBadge from '@/components/ui/FamilyStatusBadge.vue'
import DataTable from '@/components/ui/DataTable.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import MapPicker from '@/components/form/MapPicker.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

const { data: zone, isLoading, isError } = useZone(id)
const { data: families } = useZoneFamilies(id)
const { data: shelters } = useZoneShelters(id)
const { data: warehouses } = useZoneWarehouses(id)

const tab = ref<'families' | 'shelters' | 'warehouses'>('families')
const tabs = computed(() => [
  { key: 'families' as const, label: 'Familias', count: families.value?.length ?? 0 },
  { key: 'shelters' as const, label: 'Refugios', count: shelters.value?.length ?? 0 },
  { key: 'warehouses' as const, label: 'Bodegas', count: warehouses.value?.length ?? 0 },
])

// Casts para los slots de DataTable (filas tipadas por tab).
const asFamily = (r: unknown) => r as Family
const asShelter = (r: unknown) => r as ShelterWithOccupancy
const asWarehouse = (r: unknown) => r as ZoneWarehouse

// % de ocupación de refugio (verde <70 · ámbar 70-90 · rojo >90, HU-10 CA2).
const shelterPct = (s: ShelterWithOccupancy) =>
  s.max_capacity > 0 ? (s.current_occupancy / s.max_capacity) * 100 : 0
// % de uso de bodega (alerta 85%, RN-03).
const warehousePct = (w: ZoneWarehouse) =>
  w.max_capacity_kg > 0 ? (w.current_weight_kg / w.max_capacity_kg) * 100 : 0

const familyCols = [
  { key: 'family_code', label: 'Código', mono: true },
  { key: 'head_document', label: 'Documento', mono: true },
  { key: 'num_members', label: 'Miembros', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'right' as const, mono: true },
  { key: 'status', label: 'Estado' },
]
const shelterCols = [
  { key: 'name', label: 'Refugio' },
  { key: 'type', label: 'Tipo' },
  { key: 'capacity', label: 'Ocupación', align: 'center' as const },
  { key: 'occupancy', label: 'Uso' },
]
const warehouseCols = [
  { key: 'name', label: 'Bodega' },
  { key: 'address', label: 'Dirección' },
  { key: 'capacity', label: 'Peso', align: 'center' as const },
  { key: 'usage', label: 'Uso' },
]
</script>

<template>
  <section class="space-y-5">
    <!-- Carga / error -->
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="40px" width="280px" />
      <SkeletonBlock height="180px" rounded="12px" />
    </div>
    <div v-else-if="isError || !zone" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la zona.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="router.push('/zones')">
        <ArrowLeft /> Volver a zonas
      </AppButton>
    </div>

    <template v-else>
      <PageHeader :title="zone.name" crumb="Zonas">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/zones')"><ArrowLeft /> Volver</AppButton>
        </template>
      </PageHeader>

      <!-- Resumen + mini-mapa -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-neutral-500">Nivel de riesgo</span>
            <RiskLevelBadge :level="zone.risk_level" />
          </div>
          <div>
            <p class="text-sm text-neutral-500">Población estimada</p>
            <p class="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
              <Users class="h-5 w-5 text-neutral-400" />
              {{ Number(zone.estimated_population).toLocaleString('es-CO') }}
            </p>
          </div>
          <p class="flex items-center gap-1.5 font-mono text-xs text-neutral-400">
            <MapPin class="h-3.5 w-3.5" /> {{ zone.latitude.toFixed(5) }}, {{ zone.longitude.toFixed(5) }}
          </p>
        </div>
        <div class="lg:col-span-2">
          <MapPicker :latitude="zone.latitude" :longitude="zone.longitude" readonly height="240px" />
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-neutral-200">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="[
            '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-700',
          ]"
          @click="tab = t.key"
        >
          {{ t.label }} <span class="text-neutral-400">({{ t.count }})</span>
        </button>
      </div>

      <!-- Familias -->
      <DataTable v-if="tab === 'families'" :columns="familyCols" :rows="families ?? []" row-key="id" min-width="640px">
        <template #family_code="{ value }"><span class="font-semibold text-neutral-900">{{ value }}</span></template>
        <template #priority_score="{ value }">{{ Math.round(Number(value)) }}</template>
        <template #status="{ row }"><FamilyStatusBadge :status="asFamily(row).status" /></template>
        <template #empty>
          <EmptyState title="Sin familias" message="Esta zona aún no tiene familias censadas.">
            <template #icon><SearchX /></template>
          </EmptyState>
        </template>
      </DataTable>

      <!-- Refugios -->
      <DataTable v-else-if="tab === 'shelters'" :columns="shelterCols" :rows="shelters ?? []" row-key="id" min-width="640px">
        <template #name="{ value }"><span class="font-semibold text-neutral-900">{{ value }}</span></template>
        <template #type="{ row }">{{ SHELTER_TYPE_LABELS[asShelter(row).type] }}</template>
        <template #capacity="{ row }">{{ asShelter(row).current_occupancy }} / {{ asShelter(row).max_capacity }}</template>
        <template #occupancy="{ row }">
          <ProgressBar :value="shelterPct(asShelter(row))" :ok="31" :warn="10" invert />
        </template>
        <template #empty>
          <EmptyState title="Sin refugios" message="Esta zona no tiene refugios registrados.">
            <template #icon><SearchX /></template>
          </EmptyState>
        </template>
      </DataTable>

      <!-- Bodegas -->
      <DataTable v-else :columns="warehouseCols" :rows="warehouses ?? []" row-key="id" min-width="640px">
        <template #name="{ value }"><span class="font-semibold text-neutral-900">{{ value }}</span></template>
        <template #capacity="{ row }">
          {{ Math.round(asWarehouse(row).current_weight_kg).toLocaleString('es-CO') }} /
          {{ Math.round(asWarehouse(row).max_capacity_kg).toLocaleString('es-CO') }} kg
        </template>
        <template #usage="{ row }">
          <ProgressBar :value="warehousePct(asWarehouse(row))" :ok="16" :warn="1" invert />
        </template>
        <template #empty>
          <EmptyState title="Sin bodegas" message="Esta zona no tiene bodegas registradas.">
            <template #icon><SearchX /></template>
          </EmptyState>
        </template>
      </DataTable>
    </template>
  </section>
</template>
