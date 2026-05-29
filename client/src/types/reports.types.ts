// Tipos del módulo de reportes (HU-27/28/29/30). Varios campos numéricos llegan
// como string (NUMERIC/BIGINT de pg) → coerce con Number() al consumir.

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

export interface CoverageRow {
  zone_id: number
  zone_name: string
  total_families: number
  families_with_coverage: number
  coverage_pct: number
}

export interface DonationsByTypeRow {
  donor_type: string
  donation_count: number
  total_weight_kg: number
  total_monetary_amount: number | string | null
}

export interface DeliveriesByZoneRow {
  zone_id: number
  zone_name: string
  delivery_count: number
  total_weight_kg: number
  families_attended: number
}

export interface ReportInventoryRow {
  warehouse_id: number
  warehouse_name: string
  category: string | null
  total_quantity: string
  total_weight_kg: number
}

export interface TraceDelivery {
  delivery_code: string
  delivery_date: string
  status: string
  coverage_days: number
  family: { family_code: string; num_members: number }
}

export interface TraceDonation {
  donation_code: string
  donor: { name: string; type: string }
  warehouse: { name: string }
  deliveries: TraceDelivery[]
}

export interface TraceabilityResult {
  donations: TraceDonation[]
}

export interface DateRangeParams {
  from?: string
  to?: string
}

export type ExportFormat = 'pdf' | 'xlsx'
