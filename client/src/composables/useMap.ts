import { useQuery } from '@tanstack/vue-query'
import { mapApi } from '@/api/map.api'

// Una query por capa del mapa (HU-13). staleTime moderado: los datos geoespaciales
// no cambian con frecuencia.
const STALE = 1000 * 60 * 2

export function useMapLayers() {
  const shelters = useQuery({ queryKey: ['map', 'shelters'], queryFn: mapApi.shelters, staleTime: STALE })
  const warehouses = useQuery({ queryKey: ['map', 'warehouses'], queryFn: mapApi.warehouses, staleTime: STALE })
  const families = useQuery({ queryKey: ['map', 'families'], queryFn: mapApi.families, staleTime: STALE })
  const vectors = useQuery({ queryKey: ['map', 'vectors'], queryFn: mapApi.vectors, staleTime: STALE })
  const deliveries = useQuery({ queryKey: ['map', 'recent-deliveries'], queryFn: () => mapApi.recentDeliveries(7), staleTime: STALE })
  const zonesWithout = useQuery({ queryKey: ['map', 'zones-without'], queryFn: () => mapApi.zonesWithoutDeliveries(30), staleTime: STALE })
  return { shelters, warehouses, families, vectors, deliveries, zonesWithout }
}
