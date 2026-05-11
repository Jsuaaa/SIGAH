import { db } from '../db/client';

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export interface CoverageRow {
  zone_id: number;
  zone_name: string;
  total_families: string; // BIGINT comes as string from pg driver
  covered: string;
  uncovered: string;
  coverage_pct: string; // NUMERIC comes as string
}

export interface CoverageResult {
  zone_id: number;
  zone_name: string;
  total_families: number;
  covered: number;
  uncovered: number;
  coverage_pct: number;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface InventoryReportRow {
  warehouse_id: number;
  warehouse_name: string;
  category: string | null;
  total_quantity: string; // BIGINT
  total_weight_kg: number;
}

export interface InventoryReportResult {
  warehouse_id: number;
  warehouse_name: string;
  category: string | null;
  total_quantity: number;
  total_weight_kg: number;
}

// ---------------------------------------------------------------------------
// Unattended families
// ---------------------------------------------------------------------------

export interface UnattendedFamilyItem {
  family_id: number;
  family_code: string;
  family_name: string;
  zone_id: number;
  zone_name: string;
  priority_score: number | null;
  days_since_last_delivery: number;
  reason: 'NEVER_RECEIVED' | 'COVERAGE_EXPIRED';
}

interface UnattendedRow {
  data: UnattendedFamilyItem[] | null;
  total: string;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Issue #31 — Advanced Reports interfaces
// ---------------------------------------------------------------------------

export interface DonationsByTypeRow {
  donor_type: string;
  donation_count: string; // BIGINT comes as string from pg
  total_weight_kg: number;
  total_monetary_amount: string; // NUMERIC as string
}

export interface DonationsByTypeResult {
  donor_type: string;
  donation_count: number;
  total_weight_kg: number;
  total_monetary_amount: number;
}

export interface DeliveriesByZoneRow {
  zone_id: number;
  zone_name: string;
  delivery_count: string; // BIGINT
  total_weight_kg: number;
  families_attended: string; // BIGINT
}

export interface DeliveriesByZoneResult {
  zone_id: number;
  zone_name: string;
  delivery_count: number;
  total_weight_kg: number;
  families_attended: number;
}

export interface DashboardMetrics {
  total_families: number;
  total_active_families: number;
  families_covered: number;
  families_uncovered: number;
  total_deliveries_today: number;
  total_deliveries_week: number;
  low_stock_count: number;
  active_health_vectors: number;
  occupied_shelters_pct: number;
  recent_donations_7d: number;
}

export interface TraceabilityDonationDetail {
  resource_type_id: number;
  resource_type_name: string;
  category: string;
  quantity: number;
  weight_kg: number;
}

export interface TraceabilityDeliveryDetail {
  resource_type_id: number;
  resource_type_name: string;
  quantity: number;
  weight_kg: number;
}

export interface TraceabilityDelivery {
  delivery_id: number;
  delivery_code: string;
  delivery_date: string;
  status: string;
  coverage_days: number;
  family: {
    id: number;
    family_code: string;
    zone_id: number;
    num_members: number;
    status: string;
  };
  details: TraceabilityDeliveryDetail[];
}

export interface TraceabilityDonation {
  donation_id: number;
  donation_code: string;
  donation_type: string;
  monetary_amount: string | null;
  donation_date: string;
  donor: {
    id: number;
    name: string;
    type: string;
    contact: string;
  };
  warehouse: {
    id: number;
    name: string;
    address: string;
    zone_id: number;
  };
  details: TraceabilityDonationDetail[];
  deliveries: TraceabilityDelivery[];
}

export interface TraceabilityResult {
  donations: TraceabilityDonation[];
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const ReportsModel = {
  async getCoverage(): Promise<CoverageResult[]> {
    const result = await db.query<CoverageRow>(
      'SELECT * FROM fn_reports_coverage()',
    );
    return result.rows.map((r) => ({
      zone_id: r.zone_id,
      zone_name: r.zone_name,
      total_families: Number(r.total_families),
      covered: Number(r.covered),
      uncovered: Number(r.uncovered),
      coverage_pct: Number(r.coverage_pct),
    }));
  },

  async getInventory(
    warehouseId: number | null,
    category: string | null,
  ): Promise<InventoryReportResult[]> {
    const result = await db.query<InventoryReportRow>(
      'SELECT * FROM fn_reports_inventory($1, $2::resource_category)',
      [warehouseId, category],
    );
    return result.rows.map((r) => ({
      warehouse_id: r.warehouse_id,
      warehouse_name: r.warehouse_name,
      category: r.category,
      total_quantity: Number(r.total_quantity),
      total_weight_kg: r.total_weight_kg,
    }));
  },

  async getUnattendedFamilies(
    zoneId: number | null,
    since: string | null,
    limit: number,
    offset: number,
  ): Promise<{ data: UnattendedFamilyItem[]; total: number }> {
    const row = await db.queryOne<UnattendedRow>(
      'SELECT * FROM fn_reports_unattended_families($1, $2::date, $3, $4)',
      [zoneId, since, limit, offset],
    );
    if (!row) return { data: [], total: 0 };
    return {
      data: row.data ?? [],
      total: Number(row.total),
    };
  },

  // ── Issue #31 — donations grouped by donor type ───────────────────────────
  async getDonationsByType(
    from: string | null,
    to: string | null,
  ): Promise<DonationsByTypeResult[]> {
    const result = await db.query<DonationsByTypeRow>(
      'SELECT * FROM fn_reports_donations_by_type($1::date, $2::date)',
      [from, to],
    );
    return result.rows.map((r) => ({
      donor_type: r.donor_type,
      donation_count: Number(r.donation_count),
      total_weight_kg: Number(r.total_weight_kg),
      total_monetary_amount: Number(r.total_monetary_amount),
    }));
  },

  // ── Issue #31 — deliveries aggregated by zone ─────────────────────────────
  async getDeliveriesByZone(
    from: string | null,
    to: string | null,
  ): Promise<DeliveriesByZoneResult[]> {
    const result = await db.query<DeliveriesByZoneRow>(
      'SELECT * FROM fn_reports_deliveries_by_zone($1::date, $2::date)',
      [from, to],
    );
    return result.rows.map((r) => ({
      zone_id: Number(r.zone_id),
      zone_name: r.zone_name,
      delivery_count: Number(r.delivery_count),
      total_weight_kg: Number(r.total_weight_kg),
      families_attended: Number(r.families_attended),
    }));
  },

  // ── Issue #31 — dashboard (single JSONB query, no N+1) ────────────────────
  async getDashboard(): Promise<DashboardMetrics> {
    const row = await db.queryOne<{ fn_reports_dashboard: DashboardMetrics }>(
      'SELECT fn_reports_dashboard()',
    );
    // Normalize all numeric fields coming from JSONB
    const raw = row?.fn_reports_dashboard ?? {};
    return {
      total_families: Number((raw as DashboardMetrics).total_families ?? 0),
      total_active_families: Number((raw as DashboardMetrics).total_active_families ?? 0),
      families_covered: Number((raw as DashboardMetrics).families_covered ?? 0),
      families_uncovered: Number((raw as DashboardMetrics).families_uncovered ?? 0),
      total_deliveries_today: Number((raw as DashboardMetrics).total_deliveries_today ?? 0),
      total_deliveries_week: Number((raw as DashboardMetrics).total_deliveries_week ?? 0),
      low_stock_count: Number((raw as DashboardMetrics).low_stock_count ?? 0),
      active_health_vectors: Number((raw as DashboardMetrics).active_health_vectors ?? 0),
      occupied_shelters_pct: Number((raw as DashboardMetrics).occupied_shelters_pct ?? 0),
      recent_donations_7d: Number((raw as DashboardMetrics).recent_donations_7d ?? 0),
    };
  },

  // ── Issue #31 — traceability: donor → warehouse → delivery → family ───────
  async getTraceability(
    donationId: number | null,
    resourceTypeId: number | null,
    from: string | null,
    to: string | null,
  ): Promise<TraceabilityResult> {
    const row = await db.queryOne<{ fn_reports_traceability: TraceabilityResult }>(
      'SELECT fn_reports_traceability($1, $2, $3::date, $4::date)',
      [donationId, resourceTypeId, from, to],
    );
    return row?.fn_reports_traceability ?? { donations: [] };
  },
};
