import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { GeoCollection, ZoneWithoutDelivery } from '@/types/map.types'

const collection = (path: string, params?: Record<string, number>) =>
  api.get<ApiItem<GeoCollection>>(path, { params }).then((r) => r.data.data)

export const mapApi = {
  shelters: () => collection('/map/shelters'),
  warehouses: () => collection('/map/warehouses'),
  families: () => collection('/map/families'),
  vectors: () => collection('/map/vectors'),
  recentDeliveries: (days = 7) => collection('/map/recent-deliveries', { days }),
  zonesWithoutDeliveries: (days = 30) =>
    api.get<ApiItem<ZoneWithoutDelivery[]>>('/map/zones-without-deliveries', { params: { days } }).then((r) => r.data.data),
}
