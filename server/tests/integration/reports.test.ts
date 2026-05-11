/**
 * Integration tests for Issue #28 — Reportes base.
 * Endpoints: GET /api/v1/reports/coverage, /inventory, /unattended-families.
 *
 * Requires a live PostgreSQL database; cleanup is handled by ../setup.ts afterEach.
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
let censadorToken: string; // unauthorized role for these endpoints

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
  censadorToken    = sign('CENSADOR'); // should get 403
});

// ---------------------------------------------------------------------------
// World setup helpers
// ---------------------------------------------------------------------------

async function createZone(nameSuffix = ''): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Zone Reports${nameSuffix}`,
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 500,
    });
  return res.body.data.id as number;
}

async function createFamily(zoneId: number, nameSuffix = ''): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_of_family_name: `Test Family ${nameSuffix}`,
      head_of_family_document: `DOC${Date.now()}${nameSuffix}`,
      zone_id: zoneId,
      address: 'Calle 1',
      num_members: 3,
      privacy_consent_accepted: true,
    });
  if (res.status !== 201) throw new Error(`createFamily failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createWarehouse(zoneId: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Bodega Reportes',
      address: 'Carrera 5',
      zone_id: zoneId,
      max_capacity_kg: 2000,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  if (res.status !== 201) throw new Error(`createWarehouse failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function createResourceType(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Arroz ${Date.now()}`,
      category: 'FOOD',
      unit: 'kg',
      unit_weight_kg: 1.0,
      min_coverage_days: 3,
    });
  if (res.status !== 201) throw new Error(`createResourceType failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

async function addInventory(warehouseId: number, resourceTypeId: number, qty: number): Promise<void> {
  const res = await request(app)
    .post('/api/v1/inventory')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      warehouse_id: warehouseId,
      resource_type_id: resourceTypeId,
      quantity: qty,
    });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`addInventory failed: ${JSON.stringify(res.body)}`);
  }
}

async function createDelivery(
  familyId: number,
  warehouseId: number,
  resourceTypeId: number,
  coverageDays: number,
): Promise<void> {
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

  // Mark as ENTREGADA so coverage logic kicks in.
  const deliveryId: number = res.body.data.id;
  const r2 = await request(app)
    .put(`/api/v1/deliveries/${deliveryId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'EN_CURSO' });
  if (r2.status !== 200) throw new Error(`status EN_CURSO failed: ${JSON.stringify(r2.body)}`);

  const r3 = await request(app)
    .put(`/api/v1/deliveries/${deliveryId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'ENTREGADA' });
  if (r3.status !== 200) throw new Error(`status ENTREGADA failed: ${JSON.stringify(r3.body)}`);
}

// ---------------------------------------------------------------------------
// RBAC — applies to all three endpoints
// ---------------------------------------------------------------------------

describe('RBAC — reports endpoints', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/reports/coverage');
    expect(res.status).toBe(401);
  });

  it('returns 403 for CENSADOR on coverage', async () => {
    const res = await request(app)
      .get('/api/v1/reports/coverage')
      .set('Authorization', `Bearer ${censadorToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for CENSADOR on inventory', async () => {
    const res = await request(app)
      .get('/api/v1/reports/inventory')
      .set('Authorization', `Bearer ${censadorToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for CENSADOR on unattended-families', async () => {
    const res = await request(app)
      .get('/api/v1/reports/unattended-families')
      .set('Authorization', `Bearer ${censadorToken}`);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/coverage — RF-28 CA1
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/coverage', () => {
  it('returns 200 with consistent format and zone data for ADMIN', async () => {
    const zoneId = await createZone('A');
    await createFamily(zoneId, 'A');

    const res = await request(app)
      .get('/api/v1/reports/coverage')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.generated_at).toBe('string');
    expect(Array.isArray(res.body.data)).toBe(true);

    const zone = (res.body.data as Array<{
      zone_id: number;
      zone_name: string;
      total_families: number;
      covered: number;
      uncovered: number;
      coverage_pct: number;
    }>).find((z) => z.zone_id === zoneId);

    expect(zone).toBeDefined();
    expect(zone!.total_families).toBe(1);
    expect(zone!.covered).toBe(0);
    expect(zone!.uncovered).toBe(1);
    expect(zone!.coverage_pct).toBe(0);
  });

  it('shows covered=1 after a delivery is ENTREGADA with coverage not expired', async () => {
    const zoneId = await createZone('B');
    const familyId = await createFamily(zoneId, 'B');
    const warehouseId = await createWarehouse(zoneId);
    const rtId = await createResourceType();
    await addInventory(warehouseId, rtId, 100);
    await createDelivery(familyId, warehouseId, rtId, 30); // 30 days coverage

    const res = await request(app)
      .get('/api/v1/reports/coverage')
      .set('Authorization', `Bearer ${coordinatorToken}`);

    expect(res.status).toBe(200);
    const zone = (res.body.data as Array<{
      zone_id: number;
      covered: number;
      uncovered: number;
      coverage_pct: number;
    }>).find((z) => z.zone_id === zoneId);

    expect(zone).toBeDefined();
    expect(zone!.covered).toBe(1);
    expect(zone!.uncovered).toBe(0);
    expect(zone!.coverage_pct).toBe(100);
  });

  it('is accessible to FUNCIONARIO_CONTROL', async () => {
    const res = await request(app)
      .get('/api/v1/reports/coverage')
      .set('Authorization', `Bearer ${controlToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/inventory — RF-28 CA2
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/inventory', () => {
  it('returns 200 with consistent format', async () => {
    const res = await request(app)
      .get('/api/v1/reports/inventory')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.generated_at).toBe('string');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('shows correct totals after inventory is added', async () => {
    const zoneId = await createZone('C');
    const warehouseId = await createWarehouse(zoneId);
    const rtId = await createResourceType();
    await addInventory(warehouseId, rtId, 50);

    const res = await request(app)
      .get(`/api/v1/reports/inventory?warehouse_id=${warehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{
      warehouse_id: number;
      category: string;
      total_quantity: number;
    }>).find((r) => r.warehouse_id === warehouseId && r.category === 'FOOD');

    expect(row).toBeDefined();
    expect(row!.total_quantity).toBe(50);
  });

  it('filters by category', async () => {
    const zoneId = await createZone('D');
    const warehouseId = await createWarehouse(zoneId);
    const rtId = await createResourceType();
    await addInventory(warehouseId, rtId, 20);

    const res = await request(app)
      .get(`/api/v1/reports/inventory?category=FOOD`)
      .set('Authorization', `Bearer ${coordinatorToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{ category: string }>;
    const nonFood = rows.filter((r) => r.category !== 'FOOD' && r.category !== null);
    expect(nonFood.length).toBe(0);
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app)
      .get('/api/v1/reports/inventory?category=INVALID')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer warehouse_id', async () => {
    const res = await request(app)
      .get('/api/v1/reports/inventory?warehouse_id=abc')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /reports/unattended-families — RF-28 CA3
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/unattended-families', () => {
  it('returns 200 with consistent format and pagination', async () => {
    const res = await request(app)
      .get('/api/v1/reports/unattended-families')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.generated_at).toBe('string');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('returns NEVER_RECEIVED for family with no deliveries', async () => {
    const zoneId = await createZone('E');
    const familyId = await createFamily(zoneId, 'E');

    const res = await request(app)
      .get(`/api/v1/reports/unattended-families?zone_id=${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{
      family_id: number;
      reason: string;
    }>).find((r) => r.family_id === familyId);

    expect(row).toBeDefined();
    expect(row!.reason).toBe('NEVER_RECEIVED');
  });

  it('does NOT include a family with active delivery coverage', async () => {
    const zoneId = await createZone('F');
    const familyId = await createFamily(zoneId, 'F');
    const warehouseId = await createWarehouse(zoneId);
    const rtId = await createResourceType();
    await addInventory(warehouseId, rtId, 100);
    await createDelivery(familyId, warehouseId, rtId, 30);

    const res = await request(app)
      .get(`/api/v1/reports/unattended-families?zone_id=${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{ family_id: number }>).find(
      (r) => r.family_id === familyId,
    );
    expect(row).toBeUndefined();
  });

  it('orders by priority_score DESC', async () => {
    const zoneId = await createZone('G');
    await createFamily(zoneId, 'G1');
    await createFamily(zoneId, 'G2');

    const res = await request(app)
      .get(`/api/v1/reports/unattended-families?zone_id=${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{ priority_score: number | null }>;
    // Verify descending order: each priority_score >= next.
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1].priority_score ?? 0;
      const curr = rows[i].priority_score ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('filters by zone_id', async () => {
    const zoneId = await createZone('H');
    await createFamily(zoneId, 'H');

    const res = await request(app)
      .get(`/api/v1/reports/unattended-families?zone_id=${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{ zone_id: number }>;
    const wrongZone = rows.filter((r) => r.zone_id !== zoneId);
    expect(wrongZone.length).toBe(0);
  });

  it('returns 400 for invalid since date', async () => {
    const res = await request(app)
      .get('/api/v1/reports/unattended-families?since=not-a-date')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('is accessible to COORDINADOR_LOGISTICA', async () => {
    const res = await request(app)
      .get('/api/v1/reports/unattended-families')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(res.status).toBe(200);
  });
});
