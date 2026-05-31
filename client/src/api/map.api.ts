import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type {
  MapDeliveryCollection,
  MapFamilyCollection,
  MapShelterCollection,
  MapVectorCollection,
  MapWarehouseCollection,
  MapZoneAggregate,
  MapZoneWithoutDelivery,
} from '@/types/map.types'

// Capa de datos de la épica de Mapa (HU-13, HU-26). Una función por capa.
// Todos los endpoints requieren JWT (sin restricción de rol). El backend
// envuelve la respuesta en { success, data }. Las capas geográficas devuelven
// un GeoJSON FeatureCollection en `data`.
export const mapApi = {
  // GET /map/shelters — refugios con ocupación.
  shelters() {
    return api.get<ApiItem<MapShelterCollection>>('/map/shelters').then((r) => r.data.data)
  },

  // GET /map/warehouses — bodegas con % de stock.
  warehouses() {
    return api.get<ApiItem<MapWarehouseCollection>>('/map/warehouses').then((r) => r.data.data)
  },

  // GET /map/families — familias geolocalizadas SIN datos personales (HU-13 CA: sin sensibles).
  families() {
    return api.get<ApiItem<MapFamilyCollection>>('/map/families').then((r) => r.data.data)
  },

  // GET /map/vectors — focos sanitarios geolocalizados (HU-26).
  vectors() {
    return api.get<ApiItem<MapVectorCollection>>('/map/vectors').then((r) => r.data.data)
  },

  // GET /map/recent-deliveries?days=N — entregas con coordenadas de los últimos N días.
  recentDeliveries(days = 7) {
    return api
      .get<ApiItem<MapDeliveryCollection>>('/map/recent-deliveries', { params: { days } })
      .then((r) => r.data.data)
  },

  // GET /map/zones-without-deliveries?days=N — zonas sin entregas ENTREGADA en N días.
  zonesWithoutDeliveries(days = 30) {
    return api
      .get<ApiItem<MapZoneWithoutDelivery[]>>('/map/zones-without-deliveries', { params: { days } })
      .then((r) => r.data.data)
  },

  // GET /map/zone/:id — agregado geográfico de una zona.
  zoneAggregate(id: number) {
    return api.get<ApiItem<MapZoneAggregate>>(`/map/zone/${id}`).then((r) => r.data.data)
  },
}
