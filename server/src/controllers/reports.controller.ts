import * as reportsService from '../services/reports.service';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { toExcel, toPdf } from '../utils/export';
import { AppError } from '../utils/AppError';
import type { ColumnDef } from '../utils/export';

/**
 * GET /api/v1/reports/coverage
 * RF-28 CA1 — Cobertura vigente por zona.
 * Roles: ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL.
 */
export const coverage = asyncHandler(async (_req, res) => {
  const data = await reportsService.getCoverage();
  res.json({
    success: true,
    data,
    generated_at: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/reports/inventory?warehouse_id=N&category=FOOD
 * RF-28 CA2 — Stock por bodega y categoría.
 * Roles: ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL.
 */
export const inventory = asyncHandler(async (req, res) => {
  const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
  const category = req.query.category as string | undefined;

  const data = await reportsService.getInventory({
    ...(warehouse_id !== undefined ? { warehouse_id } : {}),
    ...(category !== undefined ? { category } : {}),
  });

  res.json({
    success: true,
    data,
    generated_at: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/reports/unattended-families?zone_id=N&since=YYYY-MM-DD&page=1&limit=20
 * RF-28 CA3 — Familias sin cobertura vigente, con filtros y paginación.
 * Roles: ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL.
 */
export const unattendedFamilies = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const zone_id = req.query.zone_id ? Number(req.query.zone_id) : undefined;
  const since = req.query.since as string | undefined;

  const { data, total } = await reportsService.getUnattendedFamilies({
    ...(zone_id !== undefined ? { zone_id } : {}),
    ...(since !== undefined ? { since } : {}),
    limit,
    offset: skip,
  });

  res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    generated_at: new Date().toISOString(),
  });
});

// ── Issue #31 — Advanced Reports handlers ─────────────────────────────────────

/**
 * GET /api/v1/reports/donations-by-type?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|pdf|xlsx
 * Issue #31 CA1 — Donaciones agrupadas por tipo de donante con subtotales.
 * Justificación: RF-19, HU-19, HU-28 CA4, HU-29 CA1, CA5.
 */
export const donationsByType = asyncHandler(async (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const format = (req.query.format as string | undefined) ?? 'json';

  const data = await reportsService.getDonationsByType({ from, to });

  if (format === 'xlsx') {
    const columns: ColumnDef[] = [
      { key: 'donor_type', header: 'Tipo de Donante', width: 22 },
      { key: 'donation_count', header: 'Num. Donaciones', width: 18 },
      { key: 'total_weight_kg', header: 'Peso Total (kg)', width: 18 },
      { key: 'total_monetary_amount', header: 'Monto Monetario', width: 20 },
    ];
    const buf = await toExcel(data as unknown as Record<string, unknown>[], 'Donaciones por Tipo', columns);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="donations-by-type.xlsx"');
    res.send(buf);
    return;
  }

  if (format === 'pdf') {
    const columns: ColumnDef[] = [
      { key: 'donor_type', header: 'Tipo de Donante' },
      { key: 'donation_count', header: 'Donaciones' },
      { key: 'total_weight_kg', header: 'Peso (kg)' },
      { key: 'total_monetary_amount', header: 'Monto ($)' },
    ];
    const buf = await toPdf('Reporte: Donaciones por Tipo de Donante', data as unknown as Record<string, unknown>[], columns);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="donations-by-type.pdf"');
    res.send(buf);
    return;
  }

  res.json({
    success: true,
    filters: { from: from ?? null, to: to ?? null },
    data,
    generated_at: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/reports/deliveries-by-zone?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|pdf|xlsx
 * Issue #31 CA2 — Entregas por zona con count y peso total.
 * Justificación: RF-24, HU-22, HU-28 CA4, HU-29 CA2, CA5.
 */
export const deliveriesByZone = asyncHandler(async (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const format = (req.query.format as string | undefined) ?? 'json';

  const data = await reportsService.getDeliveriesByZone({ from, to });

  if (format === 'xlsx') {
    const columns: ColumnDef[] = [
      { key: 'zone_id', header: 'ID Zona', width: 10 },
      { key: 'zone_name', header: 'Zona', width: 24 },
      { key: 'delivery_count', header: 'Num. Entregas', width: 16 },
      { key: 'total_weight_kg', header: 'Peso Total (kg)', width: 18 },
      { key: 'families_attended', header: 'Familias Atendidas', width: 20 },
    ];
    const buf = await toExcel(data as unknown as Record<string, unknown>[], 'Entregas por Zona', columns);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="deliveries-by-zone.xlsx"');
    res.send(buf);
    return;
  }

  if (format === 'pdf') {
    const columns: ColumnDef[] = [
      { key: 'zone_name', header: 'Zona' },
      { key: 'delivery_count', header: 'Entregas' },
      { key: 'total_weight_kg', header: 'Peso (kg)' },
      { key: 'families_attended', header: 'Familias' },
    ];
    const buf = await toPdf('Reporte: Entregas por Zona', data as unknown as Record<string, unknown>[], columns);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="deliveries-by-zone.pdf"');
    res.send(buf);
    return;
  }

  res.json({
    success: true,
    filters: { from: from ?? null, to: to ?? null },
    data,
    generated_at: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/reports/dashboard?format=json|pdf|xlsx
 * Issue #31 CA3 — Métricas clave en 1 sola query JSONB (sin N+1).
 * Justificación: HU-28, HU-29 CA3.
 */
export const dashboard = asyncHandler(async (req, res) => {
  const format = (req.query.format as string | undefined) ?? 'json';

  const metrics = await reportsService.getDashboard();

  if (format === 'xlsx') {
    const rows = [metrics as unknown as Record<string, unknown>];
    const columns: ColumnDef[] = [
      { key: 'total_families', header: 'Total Familias', width: 18 },
      { key: 'total_active_families', header: 'Familias Activas', width: 18 },
      { key: 'families_covered', header: 'Con Cobertura', width: 16 },
      { key: 'families_uncovered', header: 'Sin Cobertura', width: 16 },
      { key: 'total_deliveries_today', header: 'Entregas Hoy', width: 15 },
      { key: 'total_deliveries_week', header: 'Entregas Semana', width: 18 },
      { key: 'low_stock_count', header: 'Stock Bajo', width: 14 },
      { key: 'active_health_vectors', header: 'Vectores Activos', width: 18 },
      { key: 'occupied_shelters_pct', header: '% Refugios Ocupados', width: 20 },
      { key: 'recent_donations_7d', header: 'Donaciones 7d', width: 16 },
    ];
    const buf = await toExcel(rows, 'Dashboard', columns);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="dashboard.xlsx"');
    res.send(buf);
    return;
  }

  if (format === 'pdf') {
    const rows = [metrics as unknown as Record<string, unknown>];
    const columns: ColumnDef[] = [
      { key: 'total_families', header: 'Total Familias' },
      { key: 'families_covered', header: 'Con Cobertura' },
      { key: 'families_uncovered', header: 'Sin Cobertura' },
      { key: 'total_deliveries_today', header: 'Entregas Hoy' },
      { key: 'low_stock_count', header: 'Stock Bajo' },
      { key: 'occupied_shelters_pct', header: '% Refugios' },
    ];
    const buf = await toPdf('Dashboard SIGAH', rows, columns);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="dashboard.pdf"');
    res.send(buf);
    return;
  }

  res.json({
    success: true,
    data: metrics,
    generated_at: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/reports/traceability?donation_id=X&resource_type_id=Y&from=&to=&format=
 * Issue #31 CA5/CA6 — Cadena: donante → donación → bodega → entrega → familia.
 * Justificación: HU-29 CA1, CA3.
 * Requiere donation_id O resource_type_id.
 */
export const traceability = asyncHandler(async (req, res) => {
  const donation_id = req.query.donation_id ? Number(req.query.donation_id) : undefined;
  const resource_type_id = req.query.resource_type_id ? Number(req.query.resource_type_id) : undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const format = (req.query.format as string | undefined) ?? 'json';

  // HU-29 CA1: al menos uno de los dos identificadores debe estar presente
  if (donation_id === undefined && resource_type_id === undefined) {
    throw new AppError('Se requiere donation_id o resource_type_id (HU-29 CA1)', 400);
  }

  const result = await reportsService.getTraceability({
    donation_id,
    resource_type_id,
    from,
    to,
  });

  if (format === 'xlsx') {
    // Flatten para exportar: una fila por entrega
    const flatRows: Record<string, unknown>[] = [];
    for (const don of result.donations) {
      for (const del of don.deliveries) {
        flatRows.push({
          donation_code: don.donation_code,
          donor_name: don.donor.name,
          donor_type: don.donor.type,
          warehouse_name: don.warehouse.name,
          delivery_code: del.delivery_code,
          delivery_date: del.delivery_date,
          delivery_status: del.status,
          family_code: del.family.family_code,
          family_members: del.family.num_members,
          coverage_days: del.coverage_days,
        });
      }
      if (don.deliveries.length === 0) {
        flatRows.push({
          donation_code: don.donation_code,
          donor_name: don.donor.name,
          donor_type: don.donor.type,
          warehouse_name: don.warehouse.name,
          delivery_code: null,
          delivery_date: null,
          delivery_status: null,
          family_code: null,
          family_members: null,
          coverage_days: null,
        });
      }
    }
    const columns: ColumnDef[] = [
      { key: 'donation_code', header: 'Donación', width: 18 },
      { key: 'donor_name', header: 'Donante', width: 24 },
      { key: 'donor_type', header: 'Tipo Donante', width: 18 },
      { key: 'warehouse_name', header: 'Bodega', width: 22 },
      { key: 'delivery_code', header: 'Entrega', width: 18 },
      { key: 'delivery_date', header: 'Fecha Entrega', width: 18 },
      { key: 'delivery_status', header: 'Estado', width: 14 },
      { key: 'family_code', header: 'Familia', width: 18 },
      { key: 'family_members', header: 'Miembros', width: 12 },
      { key: 'coverage_days', header: 'Días Cobertura', width: 16 },
    ];
    const buf = await toExcel(flatRows, 'Trazabilidad', columns);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="traceability.xlsx"');
    res.send(buf);
    return;
  }

  if (format === 'pdf') {
    const flatRows: Record<string, unknown>[] = [];
    for (const don of result.donations) {
      for (const del of don.deliveries) {
        flatRows.push({
          donation_code: don.donation_code,
          donor_name: don.donor.name,
          warehouse_name: don.warehouse.name,
          family_code: del.family.family_code,
          delivery_date: del.delivery_date,
          coverage_days: del.coverage_days,
        });
      }
    }
    const columns: ColumnDef[] = [
      { key: 'donation_code', header: 'Donación' },
      { key: 'donor_name', header: 'Donante' },
      { key: 'warehouse_name', header: 'Bodega' },
      { key: 'family_code', header: 'Familia' },
      { key: 'delivery_date', header: 'Fecha Entrega' },
      { key: 'coverage_days', header: 'Días Cob.' },
    ];
    const buf = await toPdf('Reporte de Trazabilidad', flatRows, columns);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="traceability.pdf"');
    res.send(buf);
    return;
  }

  res.json({
    success: true,
    filters: {
      donation_id: donation_id ?? null,
      resource_type_id: resource_type_id ?? null,
      from: from ?? null,
      to: to ?? null,
    },
    data: result,
    generated_at: new Date().toISOString(),
  });
});
