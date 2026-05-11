import { ReportsModel } from '../models/reports.model';
import type {
  CoverageResult,
  InventoryReportResult,
  UnattendedFamilyItem,
  DonationsByTypeResult,
  DeliveriesByZoneResult,
  DashboardMetrics,
  TraceabilityResult,
} from '../models/reports.model';

export type {
  CoverageResult,
  InventoryReportResult,
  UnattendedFamilyItem,
  DonationsByTypeResult,
  DeliveriesByZoneResult,
  DashboardMetrics,
  TraceabilityResult,
};

/**
 * GET /reports/coverage
 * RF-28 CA1 — % cobertura vigente por zona.
 */
export async function getCoverage(): Promise<CoverageResult[]> {
  return ReportsModel.getCoverage();
}

/**
 * GET /reports/inventory
 * RF-28 CA2 — Stock agrupado por bodega y categoría.
 */
export async function getInventory(opts: {
  warehouse_id?: number;
  category?: string;
}): Promise<InventoryReportResult[]> {
  return ReportsModel.getInventory(
    opts.warehouse_id ?? null,
    opts.category ?? null,
  );
}

/**
 * GET /reports/unattended-families
 * RF-28 CA3 — Familias sin cobertura vigente, con filtros y paginación.
 */
export async function getUnattendedFamilies(opts: {
  zone_id?: number;
  since?: string;
  limit: number;
  offset: number;
}): Promise<{ data: UnattendedFamilyItem[]; total: number }> {
  return ReportsModel.getUnattendedFamilies(
    opts.zone_id ?? null,
    opts.since ?? null,
    opts.limit,
    opts.offset,
  );
}

// ── Issue #31 — Reportes avanzados ──────────────────────────────────────────

/**
 * GET /reports/donations-by-type
 * Issue #31 CA1 — Donaciones agrupadas por tipo de donante con subtotales.
 * Justificación: RF-19, HU-19, HU-29 CA1.
 */
export async function getDonationsByType(opts: {
  from?: string;
  to?: string;
}): Promise<DonationsByTypeResult[]> {
  return ReportsModel.getDonationsByType(opts.from ?? null, opts.to ?? null);
}

/**
 * GET /reports/deliveries-by-zone
 * Issue #31 CA2 — Entregas agregadas por zona con conteo y peso total.
 * Justificación: RF-24, HU-22, HU-29 CA2.
 */
export async function getDeliveriesByZone(opts: {
  from?: string;
  to?: string;
}): Promise<DeliveriesByZoneResult[]> {
  return ReportsModel.getDeliveriesByZone(opts.from ?? null, opts.to ?? null);
}

/**
 * GET /reports/dashboard
 * Issue #31 CA3 — Métricas clave en una sola consulta JSONB (evita N+1).
 * Justificación: HU-28, HU-29 CA3.
 */
export async function getDashboard(): Promise<DashboardMetrics> {
  return ReportsModel.getDashboard();
}

/**
 * GET /reports/traceability
 * Issue #31 CA5/CA6 — Rastrea cadena donante → bodega → entrega → familia.
 * Justificación: HU-29 CA1, CA3.
 */
export async function getTraceability(opts: {
  donation_id?: number;
  resource_type_id?: number;
  from?: string;
  to?: string;
}): Promise<TraceabilityResult> {
  return ReportsModel.getTraceability(
    opts.donation_id ?? null,
    opts.resource_type_id ?? null,
    opts.from ?? null,
    opts.to ?? null,
  );
}
