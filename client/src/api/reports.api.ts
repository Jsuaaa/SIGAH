import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { Family } from '@/types/family.types'
import type {
  CoverageRow, DashboardMetrics, DateRangeParams, DeliveriesByZoneRow, DonationsByTypeRow,
  ExportFormat, ReportInventoryRow, TraceabilityResult,
} from '@/types/reports.types'
import { saveBlob } from '@/utils/download'

export const reportsApi = {
  dashboard: () => api.get<ApiItem<DashboardMetrics>>('/reports/dashboard').then((r) => r.data.data),
  coverage: () => api.get<ApiItem<CoverageRow[]>>('/reports/coverage').then((r) => r.data.data),
  inventory: (params: { warehouse_id?: number; category?: string } = {}) =>
    api.get<ApiItem<ReportInventoryRow[]>>('/reports/inventory', { params }).then((r) => r.data.data),
  donationsByType: (params: DateRangeParams = {}) =>
    api.get<ApiItem<DonationsByTypeRow[]>>('/reports/donations-by-type', { params }).then((r) => r.data.data),
  deliveriesByZone: (params: DateRangeParams = {}) =>
    api.get<ApiItem<DeliveriesByZoneRow[]>>('/reports/deliveries-by-zone', { params }).then((r) => r.data.data),
  unattendedFamilies: (params: { page: number; limit: number; zone_id?: number; since?: string }) =>
    api.get<ApiList<Family>>('/reports/unattended-families', { params }).then((r) => r.data),
  traceability: (params: { donation_id?: number; resource_type_id?: number }) =>
    api.get<ApiItem<TraceabilityResult>>('/reports/traceability', { params }).then((r) => r.data.data),

  // Exportación: descarga el archivo binario (PDF/XLSX) con la cabecera JWT.
  async export(path: string, format: ExportFormat, filename: string, params: Record<string, unknown> = {}) {
    const res = await api.get(path, { params: { ...params, format }, responseType: 'blob' })
    saveBlob(res.data as Blob, filename)
  },
}
