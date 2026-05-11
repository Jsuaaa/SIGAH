/**
 * Integration tests for /api/v1/alert-thresholds and /api/v1/inventory/alerts.
 *
 * Hits the Express app via supertest. Requires a live PostgreSQL database;
 * cleanup between tests is handled by the afterEach hook in ../setup.ts.
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
let viewerToken: string;

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
  adminToken = sign('ADMIN');
  coordinatorToken = sign('COORDINADOR_LOGISTICA');
  viewerToken = sign('FUNCIONARIO_CONTROL');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupZoneWarehouse(): Promise<{ zoneId: number; warehouseId: number }> {
  const z = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Alerts',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  const w = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'WH Alerts',
      address: 'Av. 1',
      zone_id: z.body.data.id,
      max_capacity_kg: 100,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  return { zoneId: z.body.data.id, warehouseId: w.body.data.id };
}

async function createResourceType(name: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, category: 'FOOD', unit_of_measure: 'kg', unit_weight_kg: 0.1 });
  return res.body.data.id as number;
}

async function upsertInventory(
  warehouseId: number,
  resourceTypeId: number,
  quantity: number,
  expiration_date?: string,
): Promise<number> {
  const res = await request(app)
    .post('/api/v1/inventory')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      warehouse_id: warehouseId,
      resource_type_id: resourceTypeId,
      quantity,
      ...(expiration_date ? { expiration_date } : {}),
    });
  return res.body.data.id as number;
}

function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// PUT /api/v1/alert-thresholds
// ---------------------------------------------------------------------------

describe('PUT /api/v1/alert-thresholds', () => {
  it('returns 403 when role is VIEWER', async () => {
    const rt = await createResourceType('Threshold-RT');
    const res = await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ resource_type_id: rt, min_quantity: 25 });
    expect(res.status).toBe(403);
  });

  it('upserts the threshold (HU-16 CA2)', async () => {
    const rt = await createResourceType('Threshold-RT');

    const first = await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resource_type_id: rt, min_quantity: 30 });
    expect(first.status).toBe(200);
    expect(first.body.data.min_quantity).toBe(30);

    const second = await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resource_type_id: rt, min_quantity: 20 });
    expect(second.status).toBe(200);
    expect(second.body.data.min_quantity).toBe(20);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('returns 400 when min_quantity is negative', async () => {
    const rt = await createResourceType('Threshold-Neg');
    const res = await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resource_type_id: rt, min_quantity: -5 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when resource_type does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resource_type_id: 999999, min_quantity: 5 });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/alert-thresholds
// ---------------------------------------------------------------------------

describe('GET /api/v1/alert-thresholds', () => {
  it('returns thresholds joined with resource info', async () => {
    const rt = await createResourceType('Listed-RT');
    await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resource_type_id: rt, min_quantity: 15 });

    const res = await request(app)
      .get('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].min_quantity).toBe(15);
    expect(res.body.data[0].resource.name).toBe('Listed-RT');
    expect(res.body.data[0].resource.category).toBe('FOOD');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/inventory/alerts
// ---------------------------------------------------------------------------

describe('GET /api/v1/inventory/alerts', () => {
  it('reports LOW_STOCK with severity CRITICAL when quantity is 0', async () => {
    const { warehouseId } = await setupZoneWarehouse();
    const rt = await createResourceType('Low-RT');
    const inv = await upsertInventory(warehouseId, rt, 5);

    // Set a high threshold so 5 is below it.
    await request(app)
      .put('/api/v1/alert-thresholds')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resource_type_id: rt, min_quantity: 50 });

    // Drain to zero via adjustment.
    await request(app)
      .put(`/api/v1/inventory/${inv}/adjustment`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ delta: -5, reason: 'MERMA', reason_note: 'consumido' });

    const res = await request(app)
      .get('/api/v1/inventory/alerts')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);

    const lowStock = res.body.data.find(
      (a: { kind: string }) => a.kind === 'LOW_STOCK',
    );
    expect(lowStock).toBeDefined();
    expect(lowStock.severity).toBe('CRITICAL');
    expect(lowStock.link).toBe(`/warehouses/${warehouseId}`);
    expect(lowStock.metadata).toMatchObject({
      warehouse_id: warehouseId,
      resource_type_id: rt,
      threshold: 50,
    });
  });

  it('reports EXPIRED for batches with past expiration_date', async () => {
    const { warehouseId } = await setupZoneWarehouse();
    const rt = await createResourceType('Exp-RT');
    await upsertInventory(warehouseId, rt, 10, isoDateInDays(-1));

    const res = await request(app)
      .get('/api/v1/inventory/alerts')
      .set('Authorization', `Bearer ${viewerToken}`);
    const expired = res.body.data.find((a: { kind: string }) => a.kind === 'EXPIRED');
    expect(expired).toBeDefined();
    expect(expired.severity).toBe('CRITICAL');
  });

  it('reports EXPIRING_SOON within 7 days', async () => {
    const { warehouseId } = await setupZoneWarehouse();
    const rt = await createResourceType('Soon-RT');
    await upsertInventory(warehouseId, rt, 10, isoDateInDays(2));

    const res = await request(app)
      .get('/api/v1/inventory/alerts')
      .set('Authorization', `Bearer ${viewerToken}`);
    const soon = res.body.data.find((a: { kind: string }) => a.kind === 'EXPIRING_SOON');
    expect(soon).toBeDefined();
    expect(soon.severity).toBe('HIGH');
  });

  it('reports WAREHOUSE_OVER_85 with link to the warehouse', async () => {
    const { warehouseId } = await setupZoneWarehouse();
    const rt = await createResourceType('Heavy-RT');
    // Fill to >85%: 100kg cap, 0.1 kg/unit → 900 units = 90kg.
    await upsertInventory(warehouseId, rt, 900);

    const res = await request(app)
      .get('/api/v1/inventory/alerts')
      .set('Authorization', `Bearer ${viewerToken}`);
    const over = res.body.data.find(
      (a: { kind: string }) => a.kind === 'WAREHOUSE_OVER_85',
    );
    expect(over).toBeDefined();
    expect(over.link).toBe(`/warehouses/${warehouseId}`);
    expect(['HIGH', 'CRITICAL']).toContain(over.severity);
  });
});
