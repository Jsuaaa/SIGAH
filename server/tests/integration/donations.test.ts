/**
 * Integration tests for /api/v1/donations and /api/v1/donors/:id/donations.
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
let operatorToken: string;
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
  operatorToken = sign('REGISTRADOR_DONACIONES');
  viewerToken = sign('FUNCIONARIO_CONTROL');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Setup {
  donorId: number;
  warehouseId: number;
  warehouseMaxKg: number;
  resourceTypeId: number;
  unitWeightKg: number;
}

async function setupAll(maxCapacityKg = 1000, unitWeightKg = 0.5): Promise<Setup> {
  const z = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Donations',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  const w = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'WH Donations',
      address: 'Av. 1',
      zone_id: z.body.data.id,
      max_capacity_kg: maxCapacityKg,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  const rt = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Arroz',
      category: 'FOOD',
      unit_of_measure: 'kg',
      unit_weight_kg: unitWeightKg,
    });
  const d = await request(app)
    .post('/api/v1/donors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Empresa Donante',
      type: 'EMPRESA',
      contact: 'donante@empresa.co',
    });

  return {
    donorId: d.body.data.id,
    warehouseId: w.body.data.id,
    warehouseMaxKg: maxCapacityKg,
    resourceTypeId: rt.body.data.id,
    unitWeightKg,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/donations
// ---------------------------------------------------------------------------

describe('POST /api/v1/donations', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/donations').send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is VIEWER', async () => {
    const s = await setupAll();
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        donor_id: s.donorId,
        donation_type: 'MONETARY',
        monetary_amount: 100,
      });
    expect(res.status).toBe(403);
  });

  it('creates an IN_KIND donation, generates DON code, updates inventory + warehouse weight (atomic)', async () => {
    const s = await setupAll();
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [
          { resource_type_id: s.resourceTypeId, quantity: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.donation_code).toMatch(/^DON-\d{4}-\d{5}$/);

    const wh = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [s.warehouseId],
    );
    expect(Number(wh.rows[0].current_weight_kg)).toBeCloseTo(100 * s.unitWeightKg, 5);

    const inv = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [s.warehouseId, s.resourceTypeId],
    );
    expect(inv.rows[0].available_quantity).toBe(100);
  });

  it('generates strictly increasing DON codes for sequential creates (RN-07)', async () => {
    const s = await setupAll();
    const a = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 1 }],
      });
    const b = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 1 }],
      });

    const tailA = Number(a.body.data.donation_code.split('-')[2]);
    const tailB = Number(b.body.data.donation_code.split('-')[2]);
    expect(tailB).toBe(tailA + 1);
  });

  it('rolls back the entire donation when RN-03 would be violated (HU-19 CA3)', async () => {
    // Capacity = 50kg, unit_weight = 0.5, so 110 units = 55kg > 50.
    const s = await setupAll(50, 0.5);
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 110 }],
      });
    expect(res.status).toBe(422);

    // Atomicity: donation should not exist, warehouse weight unchanged,
    // inventory stays empty.
    const donations = await pool.query('SELECT id FROM donations');
    expect(donations.rows).toHaveLength(0);

    const wh = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [s.warehouseId],
    );
    expect(Number(wh.rows[0].current_weight_kg)).toBe(0);

    const inv = await pool.query('SELECT id FROM inventory WHERE warehouse_id = $1', [
      s.warehouseId,
    ]);
    expect(inv.rows).toHaveLength(0);
  });

  it('creates a MONETARY donation without touching inventory or warehouse weight', async () => {
    const s = await setupAll();
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        donation_type: 'MONETARY',
        monetary_amount: 5000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.donation_type).toBe('MONETARY');
    expect(Number(res.body.data.monetary_amount)).toBe(5000);
    expect(res.body.data.destination_warehouse_id).toBeNull();

    const wh = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [s.warehouseId],
    );
    expect(Number(wh.rows[0].current_weight_kg)).toBe(0);
  });

  it('returns 400 when MONETARY donation is missing monetary_amount', async () => {
    const s = await setupAll();
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ donor_id: s.donorId, donation_type: 'MONETARY' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when IN_KIND donation is missing destination_warehouse_id', async () => {
    const s = await setupAll();
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it('returns 404 when donor does not exist', async () => {
    const s = await setupAll();
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: 999999,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 1 }],
      });
    expect(res.status).toBe(404);
  });

  it('returns 409 when donor is inactive', async () => {
    const s = await setupAll();
    await pool.query('UPDATE donors SET is_active = FALSE WHERE id = $1', [s.donorId]);
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 1 }],
      });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/donations + filters
// ---------------------------------------------------------------------------

describe('GET /api/v1/donations', () => {
  it('filters by donor_id and type', async () => {
    const s = await setupAll();
    await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 5 }],
      });
    await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        donation_type: 'MONETARY',
        monetary_amount: 100,
      });

    const res = await request(app)
      .get(`/api/v1/donations?donor_id=${s.donorId}&type=MONETARY`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].donation_type).toBe('MONETARY');
  });

  it('embeds donor and details in each row', async () => {
    const s = await setupAll();
    await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        destination_warehouse_id: s.warehouseId,
        donation_type: 'IN_KIND',
        details: [{ resource_type_id: s.resourceTypeId, quantity: 7 }],
      });

    const res = await request(app)
      .get('/api/v1/donations')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.body.data[0].donor.name).toBe('Empresa Donante');
    expect(res.body.data[0].details).toHaveLength(1);
    expect(res.body.data[0].details[0].quantity).toBe(7);
    expect(res.body.data[0].details[0].resource_name).toBe('Arroz');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/donors/:id/donations (HU-20)
// ---------------------------------------------------------------------------

describe('GET /api/v1/donors/:id/donations', () => {
  it('returns historical donations ordered by date desc (HU-20 CA1)', async () => {
    const s = await setupAll();

    const oldRes = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        donation_type: 'MONETARY',
        monetary_amount: 100,
        date: '2026-01-01T00:00:00Z',
      });
    const newRes = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donor_id: s.donorId,
        donation_type: 'MONETARY',
        monetary_amount: 200,
        date: '2026-04-01T00:00:00Z',
      });

    const res = await request(app)
      .get(`/api/v1/donors/${s.donorId}/donations`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(newRes.body.data.id);
    expect(res.body.data[1].id).toBe(oldRes.body.data.id);
  });

  it('returns 404 when donor does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/donors/999999/donations')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });
});
