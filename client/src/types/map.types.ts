// Tipos de la épica de Mapa (HU-13 capas, HU-26 focos sanitarios).
// El backend devuelve GeoJSON FeatureCollection por capa. Coordenadas en
// orden GeoJSON: [longitude, latitude] (¡ojo: Leaflet usa [lat, lng]!).
// Campos tomados de server/db/procedures/map/fn_map_*.sql (nombres SIN traducir).

import type { FamilyStatus } from './family.types'
import type { HealthVectorStatus, RiskLevel, VectorType } from './healthVector.types'

// --- GeoJSON mínimo (espejo de server/src/models/map.model.ts) ---
export interface GeoJSONPoint {
  type: 'Point'
  // [longitude, latitude]
  coordinates: [number, number]
}

export interface GeoJSONFeature<P> {
  type: 'Feature'
  geometry: GeoJSONPoint
  properties: P
}

export interface GeoJSONFeatureCollection<P> {
  type: 'FeatureCollection'
  features: GeoJSONFeature<P>[]
}

// --- Propiedades por capa (de fn_map_*.sql) ---

// GET /map/shelters — fn_map_shelters
export interface MapShelterProps {
  id: number
  name: string
  address: string
  zone_id: number
  type: string
  max_capacity: number
  current_occupancy: number
  occupancy_pct: number | null
}

// GET /map/warehouses — fn_map_warehouses
export interface MapWarehouseProps {
  id: number
  name: string
  address: string
  zone_id: number
  status: string
  max_capacity_kg: number
  current_weight_kg: number
  stock_pct: number | null
}

// GET /map/families — fn_map_families (SIN datos personales: sin head_document/nombres)
export interface MapFamilyProps {
  id: number
  family_code: string
  zone_id: number
  shelter_id: number | null
  num_members: number
  status: FamilyStatus
  priority_score: number
}

// GET /map/vectors — fn_map_vectors
export interface MapVectorProps {
  id: number
  vector_type: VectorType
  risk_level: RiskLevel
  status: HealthVectorStatus
  zone_id: number | null
  shelter_id: number | null
  reported_date: string
}

// GET /map/recent-deliveries — fn_map_recent_deliveries
export interface MapDeliveryProps {
  id: number
  delivery_code: string
  family_id: number
  source_warehouse_id: number | null
  status: string
  delivery_date: string
  coverage_days: number | null
}

// --- FeatureCollections tipadas por capa ---
export type MapShelterCollection = GeoJSONFeatureCollection<MapShelterProps>
export type MapWarehouseCollection = GeoJSONFeatureCollection<MapWarehouseProps>
export type MapFamilyCollection = GeoJSONFeatureCollection<MapFamilyProps>
export type MapVectorCollection = GeoJSONFeatureCollection<MapVectorProps>
export type MapDeliveryCollection = GeoJSONFeatureCollection<MapDeliveryProps>

// Alias de Feature por capa (útiles para popups en la página).
export type MapShelterFeature = GeoJSONFeature<MapShelterProps>
export type MapWarehouseFeature = GeoJSONFeature<MapWarehouseProps>
export type MapFamilyFeature = GeoJSONFeature<MapFamilyProps>
export type MapVectorFeature = GeoJSONFeature<MapVectorProps>
export type MapDeliveryFeature = GeoJSONFeature<MapDeliveryProps>

// GET /map/zones-without-deliveries — fn_map_zones_without_deliveries
// (el servicio serializa family_count BIGINT a number, ver map.service.ts)
export interface MapZoneWithoutDelivery {
  zone_id: number
  zone_name: string
  risk_level: RiskLevel
  estimated_population: number
  family_count: number
}

// GET /map/zone/:id — fn_map_zone_aggregate
export interface MapZoneAggregate {
  zone_id: number
  shelters: MapShelterCollection
  warehouses: MapWarehouseCollection
  families: MapFamilyCollection
  vectors: MapVectorCollection
  recent_deliveries: MapDeliveryCollection
}

// Identificadores de capa (toggles de HU-13 CA2).
export type MapLayerKey =
  | 'shelters'
  | 'warehouses'
  | 'families'
  | 'vectors'
  | 'recentDeliveries'
  | 'zonesWithoutDeliveries'
