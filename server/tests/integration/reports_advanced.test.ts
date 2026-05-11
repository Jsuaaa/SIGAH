/**
 * Integration tests for Issue #31 — Reportes avanzados + export PDF/Excel + dashboard + trazabilidad.
 * Endpoints:
 *   GET /api/v1/reports/donations-by-type
 *   GET /api/v1/reports/deliveries-by-zone
 *   GET /api/v1/reports/dashboard
 *   GET /api/v1/reports/traceability
 *
 * Requires a live PostgreSQL database (fn_reports_* SPs must be applied).
 * Cleanup handled by ../setup.ts afterEach.
 */
import { pool } from '../setup';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from '../../src/app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';

let adminUserId: number;
let adminToken: string;
let coordinatorToken: string;
let controlToken: string;
let censadorToken: string;
let registradorToken: string;

beforeAll(async () => {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE email = 'admin@sigah.gov.co' LIMIT 1`,
  );
  if (!rows[0]) throw new Error('Run `pnpm db:seed` before integration tests.');
  adminUserId = rows[0].id;

  const sign = (role: string) =>
    jwt.sign({ id: adminUserId, email: 'admin@sigah.gov.co', role }, JWT_SECRET, {
      expiresIn: '1h',
    });

  adminToken       = sign('ADMIN');
  coordinatorToken = sign('COORDINADOR_LOGISTICA');
  controlToken     = sign('FUNCIONARIO_CONTROL');
  censadorToken    = sign('CENSADOR');
  registradorToken = sign('REGISTRADOR_DONACIONES');
});

// ---------------------------------------------------------------------------
// World setup helpers (mirrors reports.test.ts helpers)
// ---------------------------------------------------------------------------

async function createZone(name: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 500,
    });
  if (res.status !== 201) throw new Error(`createZone failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createWarehouse(zoneId: number, name: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      address: 'Av. Principal 1',
      zone_id: zoneId,
      max_capacity_kg: 5000,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  if (res.status !== 201) throw new Error(`createWarehouse failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createResourceType(nameSuffix: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Arroz ${nameSuffix}`,
      category: 'FOOD',
      unit: 'kg',
      unit_weight_kg: 1.0,
      min_coverage_days: 3,
    });
  if (res.status !== 201) throw new Error(`createResourceType failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createDonor(name: string, type = 'EMPRESA'): Promise<number> {
  const res = await request(app)
    .post('/api/v1/donors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, type, contact: 'contacto@ejemplo.com' });
  if (res.status !== 201) throw new Error(`createDonor failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createDonation(
  donorId: number,
  warehouseId: number,
  resourceTypeId: number,
  qty: number,
): Promise<number> {
  const res = await request(app)
    .post('/api/v1/donations')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      donor_id: donorId,
      destination_warehouse_id: warehouseId,
      donation_type: 'IN_KIND',
      details: [{ resource_type_id: resourceTypeId, quantity: qty, weight_kg: qty * 1.0 }],
    });
  if (res.status !== 201) throw new Error(`createDonation failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createFamily(zoneId: number, nameSuffix: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_of_family_name: `Familia Adv${nameSuffix}`,
      head_of_family_document: `DOCADV${Date.now()}${nameSuffix}`,
      zone_id: zoneId,
      address: 'Calle Reporte Avanzado',
      num_members: 4,
      privacy_consent_accepted: true,
    });
  if (res.status !== 201) throw new Error(`createFamily failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function addInventory(warehouseId: number, resourceTypeId: number, qty: number): Promise<void> {
  const res = await request(app)
    .post('/api/v1/inventory')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ warehouse_id: warehouseId, resource_type_id: resourceTypeId, quantity: qty });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`addInventory failed: ${JSON.stringify(res.body)}`);
  }
}

async function createDelivery(
  familyId: number,
  warehouseId: number,
  resourceTypeId: number,
  coverageDays = 7,
): Promise<number> {
  const res = await request(app)
    .post('/api/v1/deliveries')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      family_id: familyId,
      source_warehouse_id: warehouseId,
      coverage_days: coverageDays,
      details: [{ resource_type_id: resourceTypeId, quantity: 5 }],
    });
  if (res.status !== 201) throw new Error(`createDelivery failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

// ---------------------------------------------------------------------------
// RBAC — Issue #31 aplica los mismos roles (ADMIN | COORD | CONTROL)
// ---------------------------------------------------------------------------

describe('RBAC — advanced reports endpoints (Issue #31 CA4)', () => {
  const endpoints = [
    '/api/v1/reports/donations-by-type',
    '/api/v1/reports/deliveries-by-zone',
    '/api/v1/reports/dashboard',
  ];

  for (const ep of endpoints) {
    it(`returns 403 for CENSADOR on ${ep}`, async () => {
      const res = await request(app).get(ep).set('Authorization', `Bearer ${censadorToken}`);
      expect(res.status).toBe(403);
    });

    it(`returns 403 for REGISTRADOR_DONACIONES on ${ep}`, async () => {
      const res = await request(app).get(ep).set('Authorization', `Bearer ${registradorToken}`);
      expect(res.status).toBe(403);
    });

    it(`returns 401 with no token on ${ep}`, async () => {
      const res = await request(app).get(ep);
      expect(res.status).toBe(401);
    });
  }

  it('traceability returns 403 for CENSADOR', async () => {
    const res = await request(app)
      .get('/api/v1/reports/traceability?donation_id=1')
      .set('Authorization', `Bearer ${censadorToken}`);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/donations-by-type — Issue #31 CA1
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/donations-by-type', () => {
  it('returns 200 with array and expected fields for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/reports/donations-by-type')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.generated_at).toBe('string');
  });

  it('groups donations by donor_type with correct subtotals (CA1)', async () => {
    const zoneId = await createZone('Zone-DonAdv-1');
    const warehouseId = await createWarehouse(zoneId, 'Bodega DonAdv 1');
    const rtId = await createResourceType('DonAdv1');
    const donorId = await createDonor('Empresa DonAdv 1', 'EMPRESA');

    await createDonation(donorId, warehouseId, rtId, 50);
    await createDonation(donorId, warehouseId, rtId, 30);

    const res = await request(app)
      .get('/api/v1/reports/donations-by-type')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const empresaRow = (res.body.data as Array<{
      donor_type: string;
      donation_count: number;
      total_weight_kg: number;
      total_monetary_amount: number;
    }>).find((r) => r.donor_type === 'EMPRESA');

    expect(empresaRow).toBeDefined();
    expect(empresaRow!.donation_count).toBeGreaterThanOrEqual(2);
    // Weight: 50kg + 30kg = 80kg (from donation_details)
    expect(empresaRow!.total_weight_kg).toBeGreaterThanOrEqual(80);
  });

  it('accepts from/to date filters', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/v1/reports/donations-by-type?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.filters.from).toBe(today);
    expect(res.body.filters.to).toBe(today);
  });

  it('returns 400 for invalid from date', async () => {
    const res = await request(app)
      .get('/api/v1/reports/donations-by-type?from=not-a-date')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('?format=xlsx returns Content-Type spreadsheet (CA5 / HU-29 CA5)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/donations-by-type?format=xlsx')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
  });

  it('?format=pdf returns application/pdf (CA5 / HU-28 CA4)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/donations-by-type?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('returns 400 for invalid format', async () => {
    const res = await request(app)
      .get('/api/v1/reports/donations-by-type?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/deliveries-by-zone — Issue #31 CA2
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/deliveries-by-zone', () => {
  it('returns 200 with array and expected fields', async () => {
    const res = await request(app)
      .get('/api/v1/reports/deliveries-by-zone')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('shows correct delivery_count and families_attended per zone (CA2)', async () => {
    const zoneId = await createZone('Zone-DelAdv-1');
    const warehouseId = await createWarehouse(zoneId, 'Bodega DelAdv 1');
    const rtId = await createResourceType('DelAdv1');
    const familyId1 = await createFamily(zoneId, 'DA1');
    const familyId2 = await createFamily(zoneId, 'DA2');
    await addInventory(warehouseId, rtId, 200);

    await createDelivery(familyId1, warehouseId, rtId, 7);
    await createDelivery(familyId2, warehouseId, rtId, 7);

    const res = await request(app)
      .get('/api/v1/reports/deliveries-by-zone')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const zone = (res.body.data as Array<{
      zone_id: number;
      zone_name: string;
      delivery_count: number;
      total_weight_kg: number;
      families_attended: number;
    }>).find((r) => r.zone_id === zoneId);

    expect(zone).toBeDefined();
    expect(zone!.delivery_count).toBeGreaterThanOrEqual(2);
    expect(zone!.families_attended).toBeGreaterThanOrEqual(2);
    expect(zone!.total_weight_kg).toBeGreaterThanOrEqual(0);
  });

  it('?format=xlsx returns spreadsheet content-type (CA5)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/deliveries-by-zone?format=xlsx')
      .set('Authorization', `Bearer ${controlToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
  });

  it('?format=pdf returns application/pdf', async () => {
    const res = await request(app)
      .get('/api/v1/reports/deliveries-by-zone?format=pdf')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/dashboard — Issue #31 CA3
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/dashboard', () => {
  it('returns 200 with all required metric keys (CA3)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.generated_at).toBe('string');

    const data = res.body.data as Record<string, unknown>;
    expect(typeof data.total_families).toBe('number');
    expect(typeof data.total_active_families).toBe('number');
    expect(typeof data.families_covered).toBe('number');
    expect(typeof data.families_uncovered).toBe('number');
    expect(typeof data.total_deliveries_today).toBe('number');
    expect(typeof data.total_deliveries_week).toBe('number');
    expect(typeof data.low_stock_count).toBe('number');
    expect(typeof data.active_health_vectors).toBe('number');
    expect(typeof data.occupied_shelters_pct).toBe('number');
    expect(typeof data.recent_donations_7d).toBe('number');
  });

  it('families_covered + families_uncovered = total_families', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(res.status).toBe(200);
    const d = res.body.data as {
      total_families: number;
      families_covered: number;
      families_uncovered: number;
    };
    expect(d.families_covered + d.families_uncovered).toBe(d.total_families);
  });

  it('?format=xlsx returns spreadsheet', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard?format=xlsx')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
  });

  it('?format=pdf returns application/pdf', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/traceability — Issue #31 CA5/CA6
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/traceability', () => {
  it('returns 400 when neither donation_id nor resource_type_id provided (HU-29 CA1)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/traceability')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns full chain for a specific donation_id (CA5)', async () => {
    const zoneId = await createZone('Zone-Trace-1');
    const warehouseId = await createWarehouse(zoneId, 'Bodega Trace 1');
    const rtId = await createResourceType('Trace1');
    const donorId = await createDonor('Donante Trace', 'PERSONA_NATURAL');
    const donationId = await createDonation(donorId, warehouseId, rtId, 100);
    const familyId = await createFamily(zoneId, 'Tr1');
    await addInventory(warehouseId, rtId, 50);
    await createDelivery(familyId, warehouseId, rtId, 7);

    const res = await request(app)
      .get(`/api/v1/reports/traceability?donation_id=${donationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as { donations: Array<{
      donation_id: number;
      donor: { name: string };
      warehouse: { id: number };
      deliveries: unknown[];
    }> };
    expect(Array.isArray(data.donations)).toBe(true);
    const don = data.donations.find((d) => d.donation_id === donationId);
    expect(don).toBeDefined();
    expect(don!.donor.name).toBe('Donante Trace');
    expect(don!.warehouse.id).toBe(warehouseId);
  });

  it('returns chain for resource_type_id with date filters (CA6 / HU-29 CA3)', async () => {
    const zoneId = await createZone('Zone-Trace-2');
    const warehouseId = await createWarehouse(zoneId, 'Bodega Trace 2');
    const rtId = await createResourceType('Trace2');
    const donorId = await createDonor('Donante Trace 2', 'ALCALDIA');
    await createDonation(donorId, warehouseId, rtId, 200);

    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/v1/reports/traceability?resource_type_id=${rtId}&from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${coordinatorToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data as { donations: unknown[] };
    expect(Array.isArray(data.donations)).toBe(true);
    expect(data.donations.length).toBeGreaterThanOrEqual(1);
  });

  it('?format=xlsx returns spreadsheet', async () => {
    const zoneId = await createZone('Zone-Trace-3');
    const warehouseId = await createWarehouse(zoneId, 'Bodega Trace 3');
    const rtId = await createResourceType('Trace3');
    const donorId = await createDonor('Donante Trace 3', 'GOBERNACION');
    const donationId = await createDonation(donorId, warehouseId, rtId, 50);

    const res = await request(app)
      .get(`/api/v1/reports/traceability?donation_id=${donationId}&format=xlsx`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
  });

  it('?format=pdf returns application/pdf', async () => {
    const zoneId = await createZone('Zone-Trace-4');
    const warehouseId = await createWarehouse(zoneId, 'Bodega Trace 4');
    const rtId = await createResourceType('Trace4');
    const donorId = await createDonor('Donante Trace 4', 'ORGANIZACION');
    const donationId = await createDonation(donorId, warehouseId, rtId, 50);

    const res = await request(app)
      .get(`/api/v1/reports/traceability?donation_id=${donationId}&format=pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});
