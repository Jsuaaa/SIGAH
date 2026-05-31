import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { reportsApi } from '@/api/reports.api'
import { useZones } from '@/composables/useZones'
import type {
  UnattendedFamiliesFilters,
  TraceabilityFilters,
  ZoneWithoutDeliveries,
} from '@/types/report.types'

// HU-27 — Métricas del dashboard (1 sola query JSONB en backend).
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => reportsApi.getDashboard(),
    staleTime: 1000 * 60, // 1 min: panel de control
  })
}

// HU-27/HU-30 — Entregas por zona (gráfico de barras + base de zonas sin entregas).
export function useDeliveriesByZone(filters: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['reports', 'deliveries-by-zone', filters],
    queryFn: () => reportsApi.getDeliveriesByZone(filters),
    staleTime: 1000 * 60,
  })
}

// HU-27 — Donaciones por tipo de donante (gráfico de barras).
export function useDonationsByType(filters: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['reports', 'donations-by-type', filters],
    queryFn: () => reportsApi.getDonationsByType(filters),
    staleTime: 1000 * 60,
  })
}

// HU-28 — Cobertura por zona (sin filtros en backend; se exporta vía ?format).
export function useCoverageReport() {
  return useQuery({
    queryKey: ['reports', 'coverage'],
    queryFn: () => reportsApi.getCoverage(),
    staleTime: 1000 * 60,
  })
}

// HU-28 — Familias no atendidas (paginadas, ordenadas por priority_score desc).
export function useUnattendedFamilies(filters: Ref<UnattendedFamiliesFilters>) {
  return useQuery({
    queryKey: ['reports', 'unattended-families', filters],
    queryFn: () => reportsApi.getUnattendedFamilies(filters.value),
    placeholderData: keepPreviousData,
  })
}

// HU-29 — Trazabilidad. Solo se ejecuta cuando hay donation_id o resource_type_id
// (el backend devuelve 400 si faltan ambos), de ahí el `enabled`.
export function useTraceabilityReport(filters: Ref<TraceabilityFilters>) {
  return useQuery({
    queryKey: ['reports', 'traceability', filters],
    queryFn: () => reportsApi.getTraceability(filters.value),
    enabled: () =>
      filters.value.donation_id !== undefined || filters.value.resource_type_id !== undefined,
    placeholderData: keepPreviousData,
  })
}

/**
 * HU-30 — Zonas sin entregas.
 * El backend NO expone /reports/zones-without-deliveries; se deriva en el cliente:
 *   zonas del catálogo − zonas que aparecen en /reports/deliveries-by-zone.
 * La población sale del catálogo (Zone.estimated_population) y el número de
 * familias de /reports/coverage (total_families por zona).
 */
export function useZonesWithoutDeliveries() {
  const zonesQuery = useZones()
  const deliveriesQuery = useDeliveriesByZone()
  const coverageQuery = useCoverageReport()

  const isLoading = computed(
    () => zonesQuery.isLoading.value || deliveriesQuery.isLoading.value || coverageQuery.isLoading.value,
  )
  const isError = computed(
    () => zonesQuery.isError.value || deliveriesQuery.isError.value || coverageQuery.isError.value,
  )

  const data = computed<ZoneWithoutDeliveries[]>(() => {
    const zones = zonesQuery.data.value ?? []
    const delivered = new Set((deliveriesQuery.data.value ?? []).map((d) => d.zone_id))
    const familiesByZone = new Map(
      (coverageQuery.data.value ?? []).map((c) => [c.zone_id, c.total_families]),
    )
    return zones
      .filter((z) => !delivered.has(z.id))
      .map((z) => ({
        zone_id: z.id,
        zone_name: z.name,
        estimated_population: z.estimated_population,
        total_families: familiesByZone.get(z.id) ?? 0,
      }))
      .sort((a, b) => b.total_families - a.total_families)
  })

  function refetch() {
    void zonesQuery.refetch()
    void deliveriesQuery.refetch()
    void coverageQuery.refetch()
  }

  return { data, isLoading, isError, refetch }
}
