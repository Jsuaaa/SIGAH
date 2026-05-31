/**
 * Tipos para la épica de Analítica y Control (reportes y dashboard).
 * Los nombres de campo replican EXACTAMENTE la respuesta del backend
 * (server/db/procedures/reports/*.sql + server/src/models/reports.model.ts)
 * y por eso no se traducen.
 */

/** Formatos de exportación aceptados por el backend (?format=...). */
export type ReportFormat = 'pdf' | 'xlsx'

// ============ HU-27: Dashboard (GET /reports/dashboard) ============
// fn_reports_dashboard() devuelve un único objeto JSONB. El controller lo
// envuelve en { success, data, generated_at }. Todos los campos numéricos.
export interface DashboardMetrics {
  total_families: number
  total_active_families: number
  families_covered: number
  families_uncovered: number
  total_deliveries_today: number
  total_deliveries_week: number
  low_stock_count: number
  active_health_vectors: number
  occupied_shelters_pct: number
  recent_donations_7d: number
}

/** Fila de entregas por zona (GET /reports/deliveries-by-zone). */
export interface DeliveryByZone {
  zone_id: number
  zone_name: string
  delivery_count: number
  total_weight_kg: number
  families_attended: number
}

/** Fila de donaciones por tipo de donante (GET /reports/donations-by-type). */
export interface DonationByType {
  donor_type: string
  donation_count: number
  total_weight_kg: number
  total_monetary_amount: number
}

// ============ HU-28: Cobertura (GET /reports/coverage) ============
// fn_reports_coverage() devuelve una fila por zona. Respuesta: { success, data, generated_at }.
export interface CoverageRow {
  zone_id: number
  zone_name: string
  total_families: number
  covered: number
  uncovered: number
  coverage_pct: number
}

// GET /reports/coverage NO acepta filtros en el backend actual (controller no
// lee query params salvo format). Se mantiene el tipo por claridad de la API.
export interface CoverageFilters {
  format?: ReportFormat
}

/** Familia no atendida (GET /reports/unattended-families). */
// fn_reports_unattended_families: family_name es en realidad head_document.
export type UnattendedReason = 'NEVER_RECEIVED' | 'COVERAGE_EXPIRED'

export interface UnattendedFamily {
  family_id: number
  family_code: string
  family_name: string
  zone_id: number
  zone_name: string
  priority_score: number | null
  days_since_last_delivery: number
  reason: UnattendedReason
}

export interface UnattendedFamiliesFilters {
  zone_id?: number
  since?: string
  page?: number
  limit?: number
}

// ============ HU-29: Trazabilidad (GET /reports/traceability) ============
// Estructura JSONB anidada de fn_reports_traceability. El backend exige
// donation_id O resource_type_id (si faltan ambos responde 400).
export interface TraceabilityDonationDetail {
  resource_type_id: number
  resource_type_name: string
  category: string
  quantity: number
  weight_kg: number
}

export interface TraceabilityDeliveryDetail {
  resource_type_id: number
  resource_type_name: string
  quantity: number
  weight_kg: number
}

export interface TraceabilityFamily {
  id: number
  family_code: string
  zone_id: number
  num_members: number
  status: string
}

export interface TraceabilityDelivery {
  delivery_id: number
  delivery_code: string
  delivery_date: string
  status: string
  coverage_days: number
  family: TraceabilityFamily
  details: TraceabilityDeliveryDetail[]
}

export interface TraceabilityDonor {
  id: number
  name: string
  type: string
  contact: string
}

export interface TraceabilityWarehouse {
  id: number
  name: string
  address: string
  zone_id: number
}

export interface TraceabilityDonation {
  donation_id: number
  donation_code: string
  donation_type: string
  monetary_amount: string | null
  donation_date: string
  donor: TraceabilityDonor
  warehouse: TraceabilityWarehouse
  details: TraceabilityDonationDetail[]
  deliveries: TraceabilityDelivery[]
}

export interface TraceabilityResult {
  donations: TraceabilityDonation[]
}

// Filtros reales aceptados por el backend (validators/reports.validator.ts):
// donation_id, resource_type_id, from, to, format. NO hay filtro de zona/donante.
export interface TraceabilityFilters {
  donation_id?: number
  resource_type_id?: number
  from?: string
  to?: string
}

// ============ HU-30: Zonas sin entregas ============
// NO existe endpoint /reports/zones-without-deliveries en el backend. Se deriva
// en el cliente cruzando GET /reports/deliveries-by-zone (zonas CON entregas)
// con el catálogo de zonas (useZones → estimated_population) y GET
// /reports/coverage (total_families por zona).
export interface ZoneWithoutDeliveries {
  zone_id: number
  zone_name: string
  estimated_population: number
  total_families: number
}
