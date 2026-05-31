import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type {
  DashboardMetrics,
  DeliveryByZone,
  DonationByType,
  CoverageRow,
  UnattendedFamily,
  UnattendedFamiliesFilters,
  TraceabilityResult,
  TraceabilityFilters,
  ReportFormat,
} from '@/types/report.types'
import type { PaginationMeta } from '@/types/api.types'

// El controller de reportes envuelve los datos en { success, data, generated_at }
// (o { success, filters, data, generated_at } en los avanzados). Reutilizamos
// ApiItem<T> para { success, data } y leemos solo .data.

/**
 * Construye query params descartando valores vacíos/undefined/null. Genérico para
 * aceptar objetos de filtros tipados (sin index signature) sin perder seguridad.
 */
function buildParams(filters: object): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value)
    }
  }
  return params
}

/**
 * Descarga un reporte exportado por el backend (?format=pdf|xlsx).
 * Los handlers de reports.controller.ts responden con un Buffer (PDF o XLSX) y
 * cabecera Content-Disposition: attachment; filename="...". Pedimos el blob con
 * responseType:'blob' y forzamos la descarga con un <a> temporal +
 * URL.createObjectURL (sin file-saver, que no está instalado).
 */
async function downloadReport(
  path: string,
  format: ReportFormat,
  filters: object,
  fallbackName: string,
): Promise<void> {
  const response = await api.get(path, {
    params: { ...buildParams(filters), format },
    responseType: 'blob',
  })

  // Respetar el filename del backend si viene en Content-Disposition.
  const disposition = response.headers['content-disposition'] as string | undefined
  let filename = `${fallbackName}.${format}`
  if (disposition) {
    const match = /filename="?([^"]+)"?/.exec(disposition)
    if (match?.[1]) filename = match[1]
  }

  const blob = response.data as Blob
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

interface UnattendedResponse {
  success: boolean
  data: UnattendedFamily[]
  pagination: PaginationMeta
}

export const reportsApi = {
  // ----- HU-27: Dashboard -----
  getDashboard() {
    return api.get<ApiItem<DashboardMetrics>>('/reports/dashboard').then((r) => r.data.data)
  },

  getDeliveriesByZone(filters: { from?: string; to?: string } = {}) {
    return api
      .get<ApiItem<DeliveryByZone[]>>('/reports/deliveries-by-zone', { params: buildParams(filters) })
      .then((r) => r.data.data)
  },

  getDonationsByType(filters: { from?: string; to?: string } = {}) {
    return api
      .get<ApiItem<DonationByType[]>>('/reports/donations-by-type', { params: buildParams(filters) })
      .then((r) => r.data.data)
  },

  // ----- HU-28: Cobertura -----
  getCoverage() {
    return api.get<ApiItem<CoverageRow[]>>('/reports/coverage').then((r) => r.data.data)
  },

  exportCoverage(format: ReportFormat) {
    return downloadReport('/reports/coverage', format, {}, 'reporte-cobertura')
  },

  // Familias no atendidas (paginadas; ordenadas por priority_score desc en el SP).
  getUnattendedFamilies(filters: UnattendedFamiliesFilters = {}) {
    return api
      .get<UnattendedResponse>('/reports/unattended-families', { params: buildParams(filters) })
      .then((r) => ({ data: r.data.data, pagination: r.data.pagination }))
  },

  // ----- HU-29: Trazabilidad -----
  // El backend exige donation_id O resource_type_id.
  getTraceability(filters: TraceabilityFilters) {
    return api
      .get<ApiItem<TraceabilityResult>>('/reports/traceability', { params: buildParams(filters) })
      .then((r) => r.data.data)
  },

  exportTraceability(format: ReportFormat, filters: TraceabilityFilters) {
    return downloadReport('/reports/traceability', format, filters, 'reporte-trazabilidad')
  },
}
