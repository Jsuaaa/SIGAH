import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { reportsApi } from '@/api/reports.api'

const STALE = 1000 * 60 * 2

export function useDashboard() {
  return useQuery({ queryKey: ['reports', 'dashboard'], queryFn: reportsApi.dashboard, staleTime: STALE })
}
export function useCoverage() {
  return useQuery({ queryKey: ['reports', 'coverage'], queryFn: reportsApi.coverage, staleTime: STALE })
}
export function useDeliveriesByZone() {
  return useQuery({ queryKey: ['reports', 'deliveries-by-zone'], queryFn: () => reportsApi.deliveriesByZone(), staleTime: STALE })
}
export function useDonationsByType() {
  return useQuery({ queryKey: ['reports', 'donations-by-type'], queryFn: () => reportsApi.donationsByType(), staleTime: STALE })
}
export function useInventoryReport() {
  return useQuery({ queryKey: ['reports', 'inventory'], queryFn: () => reportsApi.inventory(), staleTime: STALE })
}

// Trazabilidad (HU-29): se dispara cuando hay donation_id válido.
export function useTraceability(donationId: Ref<number>) {
  return useQuery({
    queryKey: ['reports', 'traceability', donationId],
    queryFn: () => reportsApi.traceability({ donation_id: donationId.value }),
    enabled: computed(() => donationId.value > 0),
    retry: false,
  })
}
