import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { mapApi } from '@/api/map.api'

// Composables de la épica de Mapa (HU-13, HU-26). Una query por capa, con
// `enabled` ligado al toggle de la capa: solo se hace fetch cuando la capa está
// activa (lazy fetch por capa, HU-13). Las capas geográficas son catálogos que
// cambian poco; usamos un staleTime moderado para no refetch en cada toggle.

const LAYER_STALE_TIME = 1000 * 60 * 2 // 2 min

// Refugios (azul).
export function useMapShelters(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: ['map', 'shelters'],
    queryFn: mapApi.shelters,
    enabled: () => toValue(enabled),
    staleTime: LAYER_STALE_TIME,
  })
}

// Bodegas (verde).
export function useMapWarehouses(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: ['map', 'warehouses'],
    queryFn: mapApi.warehouses,
    enabled: () => toValue(enabled),
    staleTime: LAYER_STALE_TIME,
  })
}

// Familias (naranja) — sin datos personales.
export function useMapFamilies(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: ['map', 'families'],
    queryFn: mapApi.families,
    enabled: () => toValue(enabled),
    staleTime: LAYER_STALE_TIME,
  })
}

// Vectores sanitarios (rojo) — focos (HU-26).
export function useMapVectors(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: ['map', 'vectors'],
    queryFn: mapApi.vectors,
    enabled: () => toValue(enabled),
    staleTime: LAYER_STALE_TIME,
  })
}

// Entregas recientes (morado) — ventana de N días.
export function useMapRecentDeliveries(
  enabled: MaybeRefOrGetter<boolean>,
  days: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['map', 'recentDeliveries', days],
    queryFn: () => mapApi.recentDeliveries(toValue(days)),
    enabled: () => toValue(enabled),
    staleTime: LAYER_STALE_TIME,
  })
}

// Zonas sin entregas (resaltado) — ventana de N días.
export function useMapZonesWithoutDeliveries(
  enabled: MaybeRefOrGetter<boolean>,
  days: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['map', 'zonesWithoutDeliveries', days],
    queryFn: () => mapApi.zonesWithoutDeliveries(toValue(days)),
    enabled: () => toValue(enabled),
    staleTime: LAYER_STALE_TIME,
  })
}
