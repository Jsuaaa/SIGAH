/**
 * Integration tests for /api/v1/resource-types and /api/v1/inventory.
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
  if (!rows[0]) {
    throw new Error('Run `pnpm db:seed` before integration tests.');
  }
  adminUserId = rows[0].id;

  const sign = (role: string) =>
    jwt.sign({ id: adminUserId, email: 'admin@sigah.gov.co', role }, JWT_SECRET, {
      expiresIn: '1h',
    });

  adminToken = sign('ADMIN');
  coordinatorToken = sign('COORDINATOR');
  operatorToken = sign('OPERATOR');
  viewerToken = sign('VIEWER');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createZone(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Inventory',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  return res.body.data.id as number;
}

async function createWarehouse(
  zone_id: number,
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; max_capacity_kg: number; current_weight_kg: number }> {
  const body = {
    name: 'Bodega Inv',
    address: 'Av. 1',
    zone_id,
    max_capacity_kg: 1000,
    current_weight_kg: 0,
    status: 'ACTIVE',
    latitude: 8.74,
    longitude: -75.9,
    ...overrides,
  };
  const res = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
  return res.body.data;
}

async function createResourceType(overrides: Record<string, unknown> = {}): Promise<number> {
  const body = {
    name: 'Arroz blanco',
    category: 'FOOD',
    unit_of_measure: 'kg',
    unit_weight_kg: 1.0,
    ...overrides,
  };
  const res = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
  return res.body.data.id as number;
}

// ---------------------------------------------------------------------------
// resource_types — unique (name, category) + soft-delete
// ---------------------------------------------------------------------------

describe('POST /api/v1/resource-types', () => {
  it('returns 409 on duplicate (name, category)', async () => {
    await createResourceType();
    const res = await request(app)
      .post('/api/v1/resource-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Arroz blanco', category: 'FOOD', unit_of_measure: 'kg', unit_weight_kg: 1.0 });
    expect(res.status).toBe(409);
  });

  it('allows the same name across different categories', async () => {
    await createResourceType({ name: 'Botiquín', category: 'MEDICATION' });
    const res = await request(app)
      .post('/api/v1/resource-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Botiquín', category: 'HYGIENE', unit_of_measure: 'unidad', unit_weight_kg: 0.5 });
    expect(res.status).toBe(201);
  });

  it('rejects category MEDICATION when missing other required fields', async () => {
    const res = await request(app)
      .post('/api/v1/resource-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', category: 'MEDICATION' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown category', async () => {
    const res = await request(app)
      .post('/api/v1/resource-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', category: 'WEAPON', unit_of_measure: 'unidad', unit_weight_kg: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 403 when role is OPERATOR', async () => {
    const res = await request(app)
      .post('/api/v1/resource-types')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: 'X', category: 'FOOD', unit_of_measure: 'kg', unit_weight_kg: 1 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/resource-types/:id', () => {
  it('soft-deletes via is_active=false instead of removing the row', async () => {
    const id = await createResourceType({ name: 'SoftDelMe' });
    const res = await request(app)
      .delete(`/api/v1/resource-types/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);

    // Row still exists in the DB.
    const { rows } = await pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM resource_types WHERE id = $1',
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inventory adjustment — RN-03 + stock < 0 + warehouse weight sync
// ---------------------------------------------------------------------------

describe('PUT /api/v1/inventory/:id/adjustment', () => {
  async function setupStock(): Promise<{
    inventoryId: number;
    warehouseId: number;
    resourceTypeId: number;
  }> {
    const zoneId = await createZone();
    const warehouse = await createWarehouse(zoneId, { max_capacity_kg: 100 });
    const resourceTypeId = await createResourceType({ unit_weight_kg: 1 });

    const upsert = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouse_id: warehouse.id, resource_type_id: resourceTypeId, quantity: 50 });
    expect(upsert.status).toBe(201);

    return {
      inventoryId: upsert.body.data.id as number,
      warehouseId: warehouse.id,
      resourceTypeId,
    };
  }

  it('returns 400 when reason or reason_note is missing', async () => {
    const { inventoryId } = await setupStock();
    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ delta: -5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when delta is 0', async () => {
    const { inventoryId } = await setupStock();
    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ delta: 0, reason: 'CORRECCION', reason_note: 'noop' });
    expect(res.status).toBe(400);
  });

  it('returns 422 when adjustment would leave stock < 0 (HU-17 CA3)', async () => {
    const { inventoryId } = await setupStock();
    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ delta: -100, reason: 'MERMA', reason_note: 'caja perdida' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when adjustment would exceed warehouse max_capacity_kg (RN-03)', async () => {
    const { inventoryId } = await setupStock();
    // warehouse cap=100kg, current=50kg from upsert. +60kg would push to 110.
    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ delta: 60, reason: 'CORRECCION', reason_note: 'recuento alza' });
    expect(res.status).toBe(422);
  });

  it('updates inventory + warehouse current_weight_kg in one transaction and writes audit row', async () => {
    const { inventoryId, warehouseId } = await setupStock();
    const before = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [warehouseId],
    );
    expect(before.rows[0].current_weight_kg).toBe(50);

    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ delta: -10, reason: 'DANO', reason_note: 'mojado por inundación' });

    expect(res.status).toBe(200);
    expect(res.body.data.available_quantity).toBe(40);

    const after = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [warehouseId],
    );
    expect(after.rows[0].current_weight_kg).toBe(40);

    const audit = await pool.query<{
      delta: number;
      reason: string;
      reason_note: string;
      user_id: number;
    }>('SELECT delta, reason, reason_note, user_id FROM inventory_adjustments WHERE inventory_id = $1', [
      inventoryId,
    ]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      delta: -10,
      reason: 'DANO',
      reason_note: 'mojado por inundación',
      user_id: adminUserId,
    });
  });

  it('returns 403 when role is OPERATOR (HU-17 CA5)', async () => {
    const { inventoryId } = await setupStock();
    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ delta: -1, reason: 'CORRECCION', reason_note: 'test' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when role is VIEWER', async () => {
    const { inventoryId } = await setupStock();
    const res = await request(app)
      .put(`/api/v1/inventory/${inventoryId}/adjustment`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ delta: -1, reason: 'CORRECCION', reason_note: 'test' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// inventory list / summary
// ---------------------------------------------------------------------------

describe('GET /api/v1/inventory', () => {
  it('filters by category', async () => {
    const zoneId = await createZone();
    const wh = await createWarehouse(zoneId, { max_capacity_kg: 100 });
    const food = await createResourceType({ name: 'Arroz', category: 'FOOD', unit_weight_kg: 1 });
    const blanket = await createResourceType({ name: 'Cobija', category: 'BLANKET', unit_weight_kg: 1 });

    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouse_id: wh.id, resource_type_id: food, quantity: 10 });
    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouse_id: wh.id, resource_type_id: blanket, quantity: 5 });

    const res = await request(app)
      .get('/api/v1/inventory?category=FOOD')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].resource.category).toBe('FOOD');
  });
});

describe('GET /api/v1/inventory/summary', () => {
  it('aggregates totals by warehouse + category', async () => {
    const zoneId = await createZone();
    const wh = await createWarehouse(zoneId, { name: 'WH-Sum', max_capacity_kg: 200 });
    const r1 = await createResourceType({ name: 'A', category: 'FOOD', unit_weight_kg: 1 });
    const r2 = await createResourceType({ name: 'B', category: 'FOOD', unit_weight_kg: 0.5 });

    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouse_id: wh.id, resource_type_id: r1, quantity: 10 });
    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouse_id: wh.id, resource_type_id: r2, quantity: 20 });

    const res = await request(app)
      .get(`/api/v1/inventory/summary?warehouse_id=${wh.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    const food = res.body.data.find((d: { category: string }) => d.category === 'FOOD');
    expect(food).toBeDefined();
    expect(Number(food.total_quantity)).toBe(30);
    expect(Number(food.total_weight_kg)).toBe(20); // 10*1 + 20*0.5
  });
});

// ---------------------------------------------------------------------------
// /warehouses/:id/inventory
// ---------------------------------------------------------------------------

describe('GET /api/v1/warehouses/:id/inventory', () => {
  it('returns enriched inventory rows', async () => {
    const zoneId = await createZone();
    const wh = await createWarehouse(zoneId, { max_capacity_kg: 100 });
    const rt = await createResourceType({ unit_weight_kg: 1 });
    await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouse_id: wh.id, resource_type_id: rt, quantity: 5 });

    const res = await request(app)
      .get(`/api/v1/warehouses/${wh.id}/inventory`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].resource.name).toBe('Arroz blanco');
  });

  it('returns 404 when warehouse does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/warehouses/999999/inventory')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });
});
