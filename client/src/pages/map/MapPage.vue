<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import '@/lib/leafletSetup'
import { LMap, LTileLayer, LCircleMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import { RotateCcw } from '@lucide/vue'
import { useMapLayers } from '@/composables/useMap'
import { useZones } from '@/composables/useZones'
import { MAP_LAYERS } from '@/types/map.types'
import type { GeoCollection, MapLayerKey } from '@/types/map.types'
import { MONTERIA_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants'
import { VECTOR_TYPE_LABELS, VECTOR_STATUS_LABELS } from '@/types/healthVector.types'
import type { VectorType, HealthVectorStatus } from '@/types/healthVector.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SelectField from '@/components/form/SelectField.vue'

const { shelters, warehouses, families, vectors, deliveries, zonesWithout } = useMapLayers()
const { data: zones } = useZones()

const visible = reactive<Record<MapLayerKey, boolean>>({
  shelters: true, warehouses: true, families: true, vectors: true, deliveries: false, zonesWithout: true,
})
const zoneFilter = ref('')
const zoneFilterId = computed(() => (zoneFilter.value ? Number(zoneFilter.value) : null))
const colorOf = (key: MapLayerKey) => MAP_LAYERS.find((l) => l.key === key)!.color

const center = ref<[number, number]>([MONTERIA_CENTER.lat, MONTERIA_CENTER.lng])
const zoom = ref(MAP_DEFAULT_ZOOM)

interface MarkerPoint { key: string; latlng: [number, number]; props: Record<string, unknown> }
function toMarkers(coll: GeoCollection | undefined, prefix: string): MarkerPoint[] {
  return (coll?.features ?? [])
    .filter((f) => Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates.length === 2)
    .filter((f) => !zoneFilterId.value || f.properties.zone_id === zoneFilterId.value)
    .map((f, i) => ({
      key: `${prefix}-${f.properties.id ?? i}`,
      latlng: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
      props: f.properties,
    }))
}

const shelterPoints = computed(() => toMarkers(shelters.data.value, 'sh'))
const warehousePoints = computed(() => toMarkers(warehouses.data.value, 'wh'))
const familyPoints = computed(() => toMarkers(families.data.value, 'fa'))
const vectorPoints = computed(() => toMarkers(vectors.data.value, 've'))
const deliveryPoints = computed(() => toMarkers(deliveries.data.value, 'de'))

// Zonas sin entregas: resaltar el centro de la zona (cruce con coords de useZones).
const zoneCoords = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const zonesWithoutPoints = computed(() =>
  (zonesWithout.data.value ?? [])
    .filter((z) => !zoneFilterId.value || z.zone_id === zoneFilterId.value)
    .map((z) => {
      const zc = zoneCoords.value.get(z.zone_id)
      return zc ? { key: `zw-${z.zone_id}`, latlng: [zc.latitude, zc.longitude] as [number, number], name: z.zone_name, pop: z.estimated_population } : null
    })
    .filter((x): x is { key: string; latlng: [number, number]; name: string; pop: number } => x !== null),
)

const zoneOptions = computed(() => [{ value: '', label: 'Todas las zonas' }, ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name }))])

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const loading = computed(() => shelters.isLoading.value || warehouses.isLoading.value || families.isLoading.value)

function refetchAll() {
  shelters.refetch(); warehouses.refetch(); families.refetch(); vectors.refetch(); deliveries.refetch(); zonesWithout.refetch()
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader title="Mapa operativo" crumb="General" subtitle="Refugios, bodegas, familias y vectores en Montería (HU-13)">
      <template #actions>
        <AppButton variant="outline" size="sm" @click="refetchAll"><RotateCcw /> Actualizar</AppButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
      <!-- Mapa -->
      <div class="overflow-hidden rounded-lg border border-neutral-200 bg-white" style="height: 72vh">
        <LMap :zoom="zoom" :center="center" :use-global-leaflet="true" style="height: 100%">
          <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" :max-zoom="19" />

          <!-- Zonas sin entregas (resaltado amarillo, debajo del resto) -->
          <template v-if="visible.zonesWithout">
            <LCircleMarker
              v-for="z in zonesWithoutPoints"
              :key="z.key"
              :lat-lng="z.latlng"
              :radius="22"
              :color="colorOf('zonesWithout')"
              :fill-color="colorOf('zonesWithout')"
              :fill-opacity="0.25"
              :weight="2"
            >
              <LPopup><strong>{{ z.name }}</strong><br />Sin entregas recientes · {{ z.pop.toLocaleString('es-CO') }} hab.</LPopup>
            </LCircleMarker>
          </template>

          <template v-if="visible.deliveries">
            <LCircleMarker v-for="m in deliveryPoints" :key="m.key" :lat-lng="m.latlng" :radius="6" :color="colorOf('deliveries')" :fill-color="colorOf('deliveries')" :fill-opacity="0.8" :weight="1">
              <LPopup>Entrega · {{ String(m.props.status ?? '') }}</LPopup>
            </LCircleMarker>
          </template>

          <template v-if="visible.families">
            <LCircleMarker v-for="m in familyPoints" :key="m.key" :lat-lng="m.latlng" :radius="5" :color="colorOf('families')" :fill-color="colorOf('families')" :fill-opacity="0.8" :weight="1">
              <LPopup>Familia · estado {{ String(m.props.status ?? '—') }} · puntaje {{ Math.round(num(m.props.priority_score)) }}</LPopup>
            </LCircleMarker>
          </template>

          <template v-if="visible.warehouses">
            <LCircleMarker v-for="m in warehousePoints" :key="m.key" :lat-lng="m.latlng" :radius="8" :color="colorOf('warehouses')" :fill-color="colorOf('warehouses')" :fill-opacity="0.85" :weight="1">
              <LPopup><strong>{{ String(m.props.name ?? 'Bodega') }}</strong><br />Uso: {{ Math.round(num(m.props.stock_pct)) }}%</LPopup>
            </LCircleMarker>
          </template>

          <template v-if="visible.shelters">
            <LCircleMarker v-for="m in shelterPoints" :key="m.key" :lat-lng="m.latlng" :radius="8" :color="colorOf('shelters')" :fill-color="colorOf('shelters')" :fill-opacity="0.85" :weight="1">
              <LPopup><strong>{{ String(m.props.name ?? 'Refugio') }}</strong><br />Ocupación: {{ num(m.props.current_occupancy) }}/{{ num(m.props.max_capacity) }}</LPopup>
            </LCircleMarker>
          </template>

          <template v-if="visible.vectors">
            <LCircleMarker v-for="m in vectorPoints" :key="m.key" :lat-lng="m.latlng" :radius="7" :color="colorOf('vectors')" :fill-color="colorOf('vectors')" :fill-opacity="0.85" :weight="1">
              <LPopup>
                <strong>{{ VECTOR_TYPE_LABELS[m.props.vector_type as VectorType] ?? 'Vector' }}</strong><br />
                Estado: {{ VECTOR_STATUS_LABELS[m.props.status as HealthVectorStatus] ?? String(m.props.status ?? '') }}
              </LPopup>
            </LCircleMarker>
          </template>
        </LMap>
      </div>

      <!-- Panel de capas + leyenda + filtro -->
      <aside class="space-y-4">
        <div class="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 class="mb-2 text-sm font-semibold text-neutral-700">Zona</h2>
          <SelectField v-model="zoneFilter" :options="zoneOptions" />
        </div>
        <div class="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-semibold text-neutral-700">Capas</h2>
          <ul class="space-y-2">
            <li v-for="l in MAP_LAYERS" :key="l.key">
              <label class="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" v-model="visible[l.key]" class="h-4 w-4 accent-primary-600" />
                <span class="inline-block h-3 w-3 rounded-full" :style="{ backgroundColor: l.color }" />
                {{ l.label }}
              </label>
            </li>
          </ul>
          <p v-if="loading" class="mt-3 text-xs text-neutral-400">Cargando datos del mapa…</p>
        </div>
      </aside>
    </div>
  </section>
</template>
