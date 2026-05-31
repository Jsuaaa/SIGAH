<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import '@/lib/leafletSetup' // CSS + fix de iconos + window.L (debe ir ANTES que vue-leaflet)
import { LMap, LTileLayer, LCircleMarker, LLayerGroup, LPopup } from '@vue-leaflet/vue-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { MONTERIA_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants'
import { useZones } from '@/composables/useZones'
import {
  useMapShelters,
  useMapWarehouses,
  useMapFamilies,
  useMapVectors,
  useMapRecentDeliveries,
  useMapZonesWithoutDeliveries,
} from '@/composables/useMap'
import type { MapLayerKey } from '@/types/map.types'
import {
  HEALTH_VECTOR_STATUS_LABELS,
  HEALTH_VECTOR_STATUS_OPTIONS,
  VECTOR_TYPE_LABELS,
} from '@/types/healthVector.types'
import type { RiskLevel } from '@/types/healthVector.types'
import { FAMILY_STATUS_OPTIONS } from '@/types/family.types'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'

// Vista pesada de Leaflet de la épica de Mapa (HU-13 capas, HU-26 focos).
// Se carga de forma diferida desde MapPage.vue para no penalizar el bundle.
// Coordenadas: el backend entrega GeoJSON [lng, lat]; Leaflet usa [lat, lng].
// Convertimos en cada feature.

const center: [number, number] = [MONTERIA_CENTER.lat, MONTERIA_CENTER.lng]

// --- Estado de capas (toggles independientes, HU-13 CA2) ---
const layers = ref<Record<MapLayerKey, boolean>>({
  shelters: true,
  warehouses: true,
  families: true,
  vectors: true, // HU-26
  recentDeliveries: false,
  zonesWithoutDeliveries: false,
})

// Familias sin coordenadas se agrupan por zona (HU-13 CA5). Como no hay
// markercluster instalado y el endpoint /map/families solo devuelve familias
// CON coordenadas, ofrecemos un modo manual: agrupar las familias por zona en un
// único marcador (en el centro de la zona) con el conteo. Por defecto: individual.
const groupFamiliesByZone = ref(false)

// HU-26: por defecto solo se muestran vectores ACTIVO + EN_ATENCION.
const vectorStatuses = ref<Record<string, boolean>>({
  ACTIVO: true,
  EN_ATENCION: true,
  RESUELTO: false,
})

// Ventana de días para entregas recientes y zonas sin entregas.
const recentDays = ref(7)
const zonesWithoutDays = ref(30)

// Filtro por zona (HU-13). null = todas.
const zoneFilter = ref<number | null>(null)

// --- Catálogo de zonas (para filtro y para centroides de agrupación) ---
const zonesQuery = useZones()
const zones = computed(() => zonesQuery.data.value ?? [])
const zoneById = computed(() => {
  const m = new Map<number, { id: number; name: string; latitude: number; longitude: number }>()
  for (const z of zones.value) m.set(z.id, z)
  return m
})
function zoneName(id: number | null | undefined): string {
  if (id == null) return '—'
  return zoneById.value.get(id)?.name ?? `Zona ${id}`
}
// Centroide de una zona (para resaltar zonas sin entregas). Si la zona no está
// en el catálogo, cae al centro de Montería.
function zoneLatLng(id: number): [number, number] {
  const z = zoneById.value.get(id)
  return z ? [z.latitude, z.longitude] : center
}

// --- Queries por capa (lazy fetch ligado al toggle) ---
const sheltersQ = useMapShelters(() => layers.value.shelters)
const warehousesQ = useMapWarehouses(() => layers.value.warehouses)
const familiesQ = useMapFamilies(() => layers.value.families)
const vectorsQ = useMapVectors(() => layers.value.vectors)
const deliveriesQ = useMapRecentDeliveries(() => layers.value.recentDeliveries, recentDays)
const zonesWoQ = useMapZonesWithoutDeliveries(
  () => layers.value.zonesWithoutDeliveries,
  zonesWithoutDays,
)

// --- Helpers de coordenadas / filtro de zona ---
function toLatLng(coords: [number, number]): [number, number] {
  // GeoJSON [lng, lat] -> Leaflet [lat, lng]
  return [coords[1], coords[0]]
}
function matchesZone(zoneId: number | null | undefined): boolean {
  return zoneFilter.value == null || zoneId === zoneFilter.value
}

// --- Features derivadas (con filtro de zona aplicado en cliente) ---
const shelterFeatures = computed(() =>
  (sheltersQ.data.value?.features ?? []).filter((f) => matchesZone(f.properties.zone_id)),
)
const warehouseFeatures = computed(() =>
  (warehousesQ.data.value?.features ?? []).filter((f) => matchesZone(f.properties.zone_id)),
)
const familyFeatures = computed(() =>
  (familiesQ.data.value?.features ?? []).filter((f) => matchesZone(f.properties.zone_id)),
)

// Vectores: filtro de zona + filtro de estado (HU-26 por defecto ACTIVO/EN_ATENCION).
const vectorFeatures = computed(() =>
  (vectorsQ.data.value?.features ?? []).filter(
    (f) => matchesZone(f.properties.zone_id) && vectorStatuses.value[f.properties.status],
  ),
)

// Entregas recientes: el feature no trae zone_id, así que el filtro de zona no
// aplica (se muestran todas las del período). Las dejamos tal cual.
const deliveryFeatures = computed(() => deliveriesQ.data.value?.features ?? [])

// Zonas sin entregas: resaltado de un círculo en el centroide de la zona.
const zonesWithout = computed(() =>
  (zonesWoQ.data.value ?? []).filter((z) => matchesZone(z.zone_id)),
)

// Agrupación de familias por zona (modo manual sin markercluster, HU-13 CA5).
interface FamilyZoneGroup {
  zone_id: number
  count: number
  members: number
  latLng: [number, number]
}
const familyZoneGroups = computed<FamilyZoneGroup[]>(() => {
  const groups = new Map<number, FamilyZoneGroup>()
  for (const f of familyFeatures.value) {
    const zid = f.properties.zone_id
    const z = zoneById.value.get(zid)
    if (!z) continue
    const g = groups.get(zid) ?? {
      zone_id: zid,
      count: 0,
      members: 0,
      latLng: [z.latitude, z.longitude] as [number, number],
    }
    g.count += 1
    g.members += f.properties.num_members
    groups.set(zid, g)
  }
  return [...groups.values()]
})

// --- Colores por capa (HU-13) ---
const LAYER_COLORS = {
  shelters: '#2563eb', // azul
  warehouses: '#16a34a', // verde
  families: '#f97316', // naranja
  recentDeliveries: '#9333ea', // morado
  zonesWithout: '#dc2626', // rojo (resaltado)
} as const

// Iconos/colores de vectores por nivel de riesgo (HU-26).
const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#16a34a',
  MEDIUM: '#d97706',
  HIGH: '#ea580c',
  CRITICAL: '#dc2626',
}
function vectorRadius(risk: RiskLevel): number {
  return risk === 'CRITICAL' ? 11 : risk === 'HIGH' ? 9 : risk === 'MEDIUM' ? 7 : 6
}

// --- Etiquetas (reusamos los mapas de etiquetas del módulo de vectores y de
// familias; los valores del enum NO se traducen, solo la etiqueta visible) ---
const FAMILY_STATUS_LABELS = Object.fromEntries(
  FAMILY_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<string, string>
function vectorTypeLabel(t: string): string {
  return VECTOR_TYPE_LABELS[t as keyof typeof VECTOR_TYPE_LABELS] ?? t
}
function vectorStatusLabel(s: string): string {
  return HEALTH_VECTOR_STATUS_LABELS[s as keyof typeof HEALTH_VECTOR_STATUS_LABELS] ?? s
}
function familyStatusLabel(s: string): string {
  return FAMILY_STATUS_LABELS[s] ?? s
}

// Carga global por capa activa (para el aviso "Cargando…").
const anyLoading = computed(
  () =>
    (layers.value.shelters && sheltersQ.isLoading.value) ||
    (layers.value.warehouses && warehousesQ.isLoading.value) ||
    (layers.value.families && familiesQ.isLoading.value) ||
    (layers.value.vectors && vectorsQ.isLoading.value) ||
    (layers.value.recentDeliveries && deliveriesQ.isLoading.value) ||
    (layers.value.zonesWithoutDeliveries && zonesWoQ.isLoading.value),
)

// --- Leaflet invalidateSize cuando el contenedor cambia de tamaño ---
const root = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let ro: ResizeObserver | null = null
function onReady(m: LeafletMap) {
  map = m
  if (root.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => map?.invalidateSize())
    ro.observe(root.value)
  }
}
// Al cambiar el filtro de zona centramos en su centroide.
watch(zoneFilter, (id) => {
  if (id == null || !map) return
  const z = zoneById.value.get(id)
  if (z) map.setView([z.latitude, z.longitude], 15)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  map = null
})
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[260px_1fr]">
    <!-- Panel de control: capas, filtros y leyenda -->
    <aside class="space-y-4">
      <!-- Filtro por zona -->
      <div class="rounded-lg border border-neutral-200 bg-white p-3">
        <label class="mb-1.5 block text-xs font-semibold text-neutral-700">Zona</label>
        <select
          v-model="zoneFilter"
          class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option :value="null">Todas las zonas</option>
          <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
        </select>
      </div>

      <!-- Capas activables (HU-13 CA2) -->
      <div class="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
        <p class="text-xs font-semibold text-neutral-700">Capas</p>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="layers.shelters" type="checkbox" class="accent-blue-600" />
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: LAYER_COLORS.shelters }" />
          Refugios
        </label>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="layers.warehouses" type="checkbox" class="accent-green-600" />
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: LAYER_COLORS.warehouses }" />
          Bodegas
        </label>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="layers.families" type="checkbox" class="accent-orange-500" />
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: LAYER_COLORS.families }" />
          Familias
        </label>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="layers.vectors" type="checkbox" class="accent-red-600" />
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: RISK_COLORS.CRITICAL }" />
          Focos sanitarios
        </label>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="layers.recentDeliveries" type="checkbox" class="accent-purple-600" />
          <span
            class="h-2.5 w-2.5 rounded-full"
            :style="{ background: LAYER_COLORS.recentDeliveries }"
          />
          Entregas recientes
        </label>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input
            v-model="layers.zonesWithoutDeliveries"
            type="checkbox"
            class="accent-red-600"
          />
          <span
            class="h-2.5 w-2.5 rounded-full ring-2 ring-red-300"
            :style="{ background: LAYER_COLORS.zonesWithout }"
          />
          Zonas sin entregas
        </label>
      </div>

      <!-- Opciones de familias (HU-13 CA5: agrupar por zona) -->
      <div v-if="layers.families" class="rounded-lg border border-neutral-200 bg-white p-3">
        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="groupFamiliesByZone" type="checkbox" class="accent-orange-500" />
          Agrupar familias por zona
        </label>
        <p class="mt-1 text-xs text-neutral-500">
          Un marcador por zona con el total de familias geolocalizadas.
        </p>
      </div>

      <!-- Filtros de focos sanitarios (HU-26): por defecto ACTIVO + EN_ATENCION -->
      <div v-if="layers.vectors" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
        <p class="text-xs font-semibold text-neutral-700">Estado de focos</p>
        <label
          v-for="opt in HEALTH_VECTOR_STATUS_OPTIONS"
          :key="opt.value"
          class="flex items-center gap-2 text-sm text-neutral-700"
        >
          <input v-model="vectorStatuses[opt.value]" type="checkbox" class="accent-red-600" />
          {{ opt.label }}
        </label>
      </div>

      <!-- Ventanas de tiempo -->
      <div
        v-if="layers.recentDeliveries"
        class="rounded-lg border border-neutral-200 bg-white p-3"
      >
        <label class="mb-1.5 block text-xs font-semibold text-neutral-700">
          Entregas: últimos días
        </label>
        <input
          v-model.number="recentDays"
          type="number"
          min="1"
          max="365"
          class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div
        v-if="layers.zonesWithoutDeliveries"
        class="rounded-lg border border-neutral-200 bg-white p-3"
      >
        <label class="mb-1.5 block text-xs font-semibold text-neutral-700">
          Zonas sin entregas: días
        </label>
        <input
          v-model.number="zonesWithoutDays"
          type="number"
          min="1"
          max="365"
          class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <!-- Leyenda (HU-13) -->
      <div class="space-y-1.5 rounded-lg border border-neutral-200 bg-white p-3 text-xs">
        <p class="font-semibold text-neutral-700">Leyenda</p>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: LAYER_COLORS.shelters }" />
          Refugio
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: LAYER_COLORS.warehouses }" />
          Bodega
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: LAYER_COLORS.families }" />
          Familia
        </div>
        <div class="flex items-center gap-2">
          <span
            class="h-2.5 w-2.5 rounded-full"
            :style="{ background: LAYER_COLORS.recentDeliveries }"
          />
          Entrega reciente
        </div>
        <p class="pt-1 font-semibold text-neutral-700">Foco por nivel de riesgo</p>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: RISK_COLORS.LOW }" />
          Bajo
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: RISK_COLORS.MEDIUM }" />
          Medio
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: RISK_COLORS.HIGH }" />
          Alto
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: RISK_COLORS.CRITICAL }" />
          Crítico
        </div>
      </div>
    </aside>

    <!-- Mapa -->
    <div ref="root" class="relative overflow-hidden rounded-lg border border-neutral-300">
      <div
        v-if="anyLoading"
        class="absolute right-3 top-3 z-[1000] rounded-md bg-white/90 px-3 py-1.5 text-xs text-neutral-600 shadow"
      >
        Cargando capas…
      </div>

      <LMap
        :zoom="MAP_DEFAULT_ZOOM"
        :center="center"
        :use-global-leaflet="true"
        style="height: 75vh; min-height: 480px"
        @ready="onReady"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
          :max-zoom="19"
        />

        <!-- Zonas sin entregas: marcador de resaltado en el centroide -->
        <LLayerGroup v-if="layers.zonesWithoutDeliveries">
          <LCircleMarker
            v-for="z in zonesWithout"
            :key="`zwo-${z.zone_id}`"
            :lat-lng="zoneLatLng(z.zone_id)"
            :radius="16"
            :color="LAYER_COLORS.zonesWithout"
            :fill-color="LAYER_COLORS.zonesWithout"
            :fill-opacity="0.18"
            :weight="3"
          >
            <LPopup>
              <div class="space-y-1 text-sm">
                <p class="font-semibold">{{ z.zone_name }}</p>
                <p>Sin entregas en el período</p>
                <p class="text-neutral-600">Población estimada: {{ z.estimated_population }}</p>
                <p class="text-neutral-600">Familias registradas: {{ z.family_count }}</p>
              </div>
            </LPopup>
          </LCircleMarker>
        </LLayerGroup>

        <!-- Refugios (azul) -->
        <LLayerGroup v-if="layers.shelters">
          <LCircleMarker
            v-for="f in shelterFeatures"
            :key="`shel-${f.properties.id}`"
            :lat-lng="toLatLng(f.geometry.coordinates)"
            :radius="8"
            :color="LAYER_COLORS.shelters"
            :fill-color="LAYER_COLORS.shelters"
            :fill-opacity="0.85"
            :weight="1.5"
          >
            <LPopup>
              <div class="space-y-0.5 text-sm">
                <p class="font-semibold">{{ f.properties.name }}</p>
                <p class="text-neutral-600">{{ f.properties.address }}</p>
                <p class="text-neutral-600">Zona: {{ zoneName(f.properties.zone_id) }}</p>
                <p>
                  Ocupación: {{ f.properties.current_occupancy }}/{{ f.properties.max_capacity }}
                  <span v-if="f.properties.occupancy_pct != null">
                    ({{ f.properties.occupancy_pct }}%)
                  </span>
                </p>
              </div>
            </LPopup>
          </LCircleMarker>
        </LLayerGroup>

        <!-- Bodegas (verde) -->
        <LLayerGroup v-if="layers.warehouses">
          <LCircleMarker
            v-for="f in warehouseFeatures"
            :key="`wh-${f.properties.id}`"
            :lat-lng="toLatLng(f.geometry.coordinates)"
            :radius="8"
            :color="LAYER_COLORS.warehouses"
            :fill-color="LAYER_COLORS.warehouses"
            :fill-opacity="0.85"
            :weight="1.5"
          >
            <LPopup>
              <div class="space-y-0.5 text-sm">
                <p class="font-semibold">{{ f.properties.name }}</p>
                <p class="text-neutral-600">{{ f.properties.address }}</p>
                <p class="text-neutral-600">Zona: {{ zoneName(f.properties.zone_id) }}</p>
                <p>Estado: {{ f.properties.status }}</p>
                <p>
                  Stock: {{ f.properties.current_weight_kg }}/{{ f.properties.max_capacity_kg }} kg
                  <span v-if="f.properties.stock_pct != null">({{ f.properties.stock_pct }}%)</span>
                </p>
              </div>
            </LPopup>
          </LCircleMarker>
        </LLayerGroup>

        <!-- Familias (naranja) — individuales o agrupadas por zona (HU-13 CA5) -->
        <LLayerGroup v-if="layers.families">
          <template v-if="groupFamiliesByZone">
            <LCircleMarker
              v-for="g in familyZoneGroups"
              :key="`fzg-${g.zone_id}`"
              :lat-lng="g.latLng"
              :radius="Math.min(10 + g.count, 24)"
              :color="LAYER_COLORS.families"
              :fill-color="LAYER_COLORS.families"
              :fill-opacity="0.7"
              :weight="1.5"
            >
              <LPopup>
                <div class="space-y-0.5 text-sm">
                  <p class="font-semibold">{{ zoneName(g.zone_id) }}</p>
                  <p>Familias: {{ g.count }}</p>
                  <p class="text-neutral-600">Integrantes: {{ g.members }}</p>
                </div>
              </LPopup>
            </LCircleMarker>
          </template>
          <template v-else>
            <!-- Popup SIN datos sensibles: solo código, estado, prioridad, zona, coords -->
            <LCircleMarker
              v-for="f in familyFeatures"
              :key="`fam-${f.properties.id}`"
              :lat-lng="toLatLng(f.geometry.coordinates)"
              :radius="6"
              :color="LAYER_COLORS.families"
              :fill-color="LAYER_COLORS.families"
              :fill-opacity="0.85"
              :weight="1.5"
            >
              <LPopup>
                <div class="space-y-0.5 text-sm">
                  <p class="font-semibold">{{ f.properties.family_code }}</p>
                  <p>Estado: {{ familyStatusLabel(f.properties.status) }}</p>
                  <p>Prioridad: {{ f.properties.priority_score }}</p>
                  <p class="text-neutral-600">Integrantes: {{ f.properties.num_members }}</p>
                  <p class="text-neutral-600">Zona: {{ zoneName(f.properties.zone_id) }}</p>
                  <p class="text-neutral-500">
                    {{ f.geometry.coordinates[1].toFixed(5) }},
                    {{ f.geometry.coordinates[0].toFixed(5) }}
                  </p>
                </div>
              </LPopup>
            </LCircleMarker>
          </template>
        </LLayerGroup>

        <!-- Focos sanitarios (HU-26) — color y tamaño por nivel de riesgo -->
        <LLayerGroup v-if="layers.vectors">
          <LCircleMarker
            v-for="f in vectorFeatures"
            :key="`vec-${f.properties.id}`"
            :lat-lng="toLatLng(f.geometry.coordinates)"
            :radius="vectorRadius(f.properties.risk_level)"
            :color="RISK_COLORS[f.properties.risk_level]"
            :fill-color="RISK_COLORS[f.properties.risk_level]"
            :fill-opacity="0.8"
            :weight="2"
          >
            <LPopup>
              <div class="space-y-1 text-sm">
                <p class="font-semibold">{{ vectorTypeLabel(f.properties.vector_type) }}</p>
                <RiskLevelBadge :level="f.properties.risk_level" />
                <p>Estado: {{ vectorStatusLabel(f.properties.status) }}</p>
                <p class="text-neutral-600">Zona: {{ zoneName(f.properties.zone_id) }}</p>
                <p class="text-neutral-500">
                  Reportado: {{ String(f.properties.reported_date).slice(0, 10) }}
                </p>
              </div>
            </LPopup>
          </LCircleMarker>
        </LLayerGroup>

        <!-- Entregas recientes (morado) -->
        <LLayerGroup v-if="layers.recentDeliveries">
          <LCircleMarker
            v-for="f in deliveryFeatures"
            :key="`del-${f.properties.id}`"
            :lat-lng="toLatLng(f.geometry.coordinates)"
            :radius="6"
            :color="LAYER_COLORS.recentDeliveries"
            :fill-color="LAYER_COLORS.recentDeliveries"
            :fill-opacity="0.85"
            :weight="1.5"
          >
            <LPopup>
              <div class="space-y-0.5 text-sm">
                <p class="font-semibold">{{ f.properties.delivery_code }}</p>
                <p>Estado: {{ f.properties.status }}</p>
                <p class="text-neutral-600">
                  Fecha: {{ String(f.properties.delivery_date).slice(0, 10) }}
                </p>
                <p v-if="f.properties.coverage_days != null" class="text-neutral-600">
                  Cobertura: {{ f.properties.coverage_days }} días
                </p>
              </div>
            </LPopup>
          </LCircleMarker>
        </LLayerGroup>
      </LMap>
    </div>
  </div>
</template>
