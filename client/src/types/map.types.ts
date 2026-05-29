// Tipos para el mapa (HU-13/26/30). Los endpoints /map/* devuelven GeoJSON
// FeatureCollection con coordenadas [lng, lat].

export interface GeoFeature<P = Record<string, unknown>> {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: P & { id?: number; zone_id?: number }
}

export interface GeoCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection'
  features: GeoFeature<P>[]
}

export interface ZoneWithoutDelivery {
  zone_id: number
  zone_name: string
  risk_level: string
  estimated_population: number
  family_count: string
}

export type MapLayerKey = 'shelters' | 'warehouses' | 'families' | 'vectors' | 'deliveries' | 'zonesWithout'

export interface MapLayerConfig {
  key: MapLayerKey
  label: string
  color: string
}

// Colores por capa (FRONTEND-PLAN §3.12).
export const MAP_LAYERS: MapLayerConfig[] = [
  { key: 'shelters', label: 'Refugios', color: '#1e5ba8' },
  { key: 'warehouses', label: 'Bodegas', color: '#0e7c66' },
  { key: 'families', label: 'Familias', color: '#c2410c' },
  { key: 'vectors', label: 'Vectores', color: '#b91c1c' },
  { key: 'deliveries', label: 'Entregas recientes', color: '#7c3aed' },
  { key: 'zonesWithout', label: 'Zonas sin entregas', color: '#eab308' },
]
