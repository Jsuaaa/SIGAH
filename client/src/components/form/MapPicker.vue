<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import '@/lib/leafletSetup' // CSS + fix de iconos + window.L (debe ir antes que vue-leaflet)
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet'
import type { Map as LeafletMap, LeafletMouseEvent, LeafletEvent, Marker } from 'leaflet'
import { MONTERIA_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants'

// Selector de ubicación reutilizable (refugios, bodegas, familias, vectores).
// Clic en el mapa coloca el marcador; el marcador es arrastrable para ajustar.
// Coordenadas vía v-model:latitude / v-model:longitude.
const props = withDefaults(
  defineProps<{
    latitude: number | null
    longitude: number | null
    height?: string
    zoom?: number
    readonly?: boolean
  }>(),
  { height: '320px', zoom: MAP_DEFAULT_ZOOM, readonly: false },
)
const emit = defineEmits<{
  (e: 'update:latitude', v: number): void
  (e: 'update:longitude', v: number): void
}>()

// Centro inicial fijo (no sigue al marcador, para que el mapa no "salte" en cada clic).
const initialCenter: [number, number] =
  props.latitude != null && props.longitude != null
    ? [props.latitude, props.longitude]
    : [MONTERIA_CENTER.lat, MONTERIA_CENTER.lng]

const hasMarker = computed(() => props.latitude != null && props.longitude != null)
const markerLatLng = computed<[number, number]>(() => [props.latitude as number, props.longitude as number])

function emitLatLng(lat: number, lng: number) {
  emit('update:latitude', Number(lat.toFixed(6)))
  emit('update:longitude', Number(lng.toFixed(6)))
}
function onMapClick(e: LeafletMouseEvent) {
  if (props.readonly) return
  emitLatLng(e.latlng.lat, e.latlng.lng)
}
function onMarkerDragEnd(e: LeafletEvent) {
  const { lat, lng } = (e.target as Marker).getLatLng()
  emitLatLng(lat, lng)
}

// Leaflet dentro de un modal arranca sin dimensiones: observamos el contenedor
// y recalculamos el tamaño del mapa cuando se hace visible.
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
onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  map = null
})
</script>

<template>
  <div ref="root" class="overflow-hidden rounded-md border border-neutral-300">
    <LMap
      :zoom="zoom"
      :center="initialCenter"
      :use-global-leaflet="true"
      :style="{ height, cursor: readonly ? 'grab' : 'crosshair' }"
      @click="onMapClick"
      @ready="onReady"
    >
      <LTileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
        :max-zoom="19"
      />
      <LMarker
        v-if="hasMarker"
        :lat-lng="markerLatLng"
        :draggable="!readonly"
        @dragend="onMarkerDragEnd"
      />
    </LMap>
  </div>
</template>
