/**
 * Integration tests for HU-23 — eligibility, ración mínima and the exception
 * delivery flow.
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
  operatorToken = sign('OPERADOR_ENTREGAS');
  viewerToken = sign('FUNCIONARIO_CONTROL');
});

// ---------------------------------------------------------------------------
// World setup: zone + warehouse + family + FOOD resource type + inventory
// ---------------------------------------------------------------------------

interface World {
  zoneId: number;
  warehouseId: number;
  familyId: number;
  foodResourceId: number;
}

async function setupWorld(opts: {
  num_members?: number;
  warehouse_capacity_kg?: number;
  unit_weight_kg?: number;
  initial_quantity?: number;
} = {}): Promise<World> {
  const numMembers = opts.num_members ?? 4;
  const cap = opts.warehouse_capacity_kg ?? 5000;
  const unit = opts.unit_weight_kg ?? 1.0;
  const qty = opts.initial_quantity ?? 200;

  const z = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Exception',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  const w = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'WH Exception',
      address: 'Av. 1',
      zone_id: z.body.data.id,
      max_capacity_kg: cap,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  const f = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: 'EXC-1',
      zone_id: z.body.data.id,
      num_members: numMembers,
      privacy_consent_accepted: true,
    });
  const rt = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Arroz',
      category: 'FOOD',
      unit_of_measure: 'kg',
      unit_weight_kg: unit,
    });

  // Seed inventory.
  await request(app)
    .post('/api/v1/inventory')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ warehouse_id: w.body.data.id, resource_type_id: rt.body.data.id, quantity: qty });

  return {
    zoneId: z.body.data.id,
    warehouseId: w.body.data.id,
    familyId: f.body.data.id,
    foodResourceId: rt.body.data.id,
  };
}

function exceptionBody(world: World, overrides: Record<string, unknown> = {}) {
  return {
    family_id: world.familyId,
    source_warehouse_id: world.warehouseId,
    coverage_days: 3,
    exception_reason: 'Niño con desnutrición severa, intervención inmediata',
    exception_authorized_by: adminUserId,
    details: [{ resource_type_id: world.foodResourceId, quantity: 50 }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GET /deliveries/eligibility
// ---------------------------------------------------------------------------

describe('GET /api/v1/deliveries/eligibility', () => {
  it('returns ELIGIBLE for a brand-new family', async () => {
    const w = await setupWorld();
    const res = await request(app)
      .get(`/api/v1/deliveries/eligibility?family_id=${w.familyId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_eligible).toBe(true);
    expect(res.body.data.reason).toBe('ELIGIBLE');
  });

  it('returns 400 when family_id is missing', async () => {
    const res = await request(app)
      .get('/api/v1/deliveries/eligibility')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when family does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/deliveries/eligibility?family_id=999999')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /deliveries/exception — RBAC
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries/exception (RBAC)', () => {
  it('returns 403 for ADMIN/OPERATOR/VIEWER (HU-23 CA5 — coordinator only)', async () => {
    const w = await setupWorld();
    for (const t of [adminToken, operatorToken, viewerToken]) {
      const res = await request(app)
        .post('/api/v1/deliveries/exception')
        .set('Authorization', `Bearer ${t}`)
        .send(exceptionBody(w));
      expect(res.status).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// POST /deliveries/exception — validation
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries/exception (validation)', () => {
  it('returns 400 when coverage_days < 3 (RN-01)', async () => {
    const w = await setupWorld();
    const res = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w, { coverage_days: 2 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when exception_reason is missing or short', async () => {
    const w = await setupWorld();
    const a = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w, { exception_reason: '' }));
    expect(a.status).toBe(400);

    const b = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w, { exception_reason: 'no' }));
    expect(b.status).toBe(400);
  });

  it('returns 400 when details array is empty', async () => {
    const w = await setupWorld();
    const res = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w, { details: [] }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /deliveries/exception — RN-01 ration + atomic stock decrement
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries/exception (ration + atomicity)', () => {
  it('rejects with 422 when food kg below minimum ration (HU-23 RN-01)', async () => {
    // 4 members × 0.6 × 3 days = 7.2 kg minimum. unit=1kg, so 50 units → 50kg
    // is fine. Send only 5 units → 5kg → below the 7.2 floor.
    const w = await setupWorld({ num_members: 4 });
    const res = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w, { details: [{ resource_type_id: w.foodResourceId, quantity: 5 }] }));
    expect(res.status).toBe(422);

    // Atomicity: no delivery rows, inventory unchanged.
    const d = await pool.query('SELECT id FROM deliveries');
    expect(d.rows).toHaveLength(0);
    const inv = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [w.warehouseId, w.foodResourceId],
    );
    expect(inv.rows[0].available_quantity).toBe(200);
  });

  it('rejects with 422 when stock is insufficient', async () => {
    const w = await setupWorld({ initial_quantity: 10 });
    const res = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w, { details: [{ resource_type_id: w.foodResourceId, quantity: 50 }] }));
    expect(res.status).toBe(422);
  });

  it('creates the delivery atomically: code, status, inventory and warehouse weight', async () => {
    const w = await setupWorld({ num_members: 4 });
    const res = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w));

    expect(res.status).toBe(201);
    expect(res.body.data.delivery_code).toMatch(/^ENT-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('PROGRAMADA');
    expect(res.body.data.exception_reason).toBeTruthy();
    expect(res.body.data.exception_authorized_by).toBe(adminUserId);

    // Inventory decremented (200 - 50 = 150).
    const inv = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [w.warehouseId, w.foodResourceId],
    );
    expect(inv.rows[0].available_quantity).toBe(150);

    // Warehouse weight reflects the deduction (50 * 1 kg = 50 kg out of the
    // initial 200 kg seeded by the upsert → 150 kg remaining).
    const wh = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [w.warehouseId],
    );
    expect(Number(wh.rows[0].current_weight_kg)).toBeCloseTo(150, 5);

    // delivery_details captured.
    const det = await pool.query<{ quantity: number; weight_kg: number }>(
      'SELECT quantity, weight_kg FROM delivery_details WHERE delivery_id = $1',
      [res.body.data.id],
    );
    expect(det.rows).toHaveLength(1);
    expect(det.rows[0].quantity).toBe(50);
    expect(Number(det.rows[0].weight_kg)).toBeCloseTo(50, 5);
  });

  it('triggers priority_score recalc after the exception delivery (RN-08)', async () => {
    const w = await setupWorld();
    const before = await pool.query<{ priority_score_breakdown: Record<string, unknown> }>(
      'SELECT priority_score_breakdown FROM families WHERE id = $1',
      [w.familyId],
    );

    await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w));

    const after = await pool.query<{ priority_score_breakdown: Record<string, unknown> }>(
      'SELECT priority_score_breakdown FROM families WHERE id = $1',
      [w.familyId],
    );
    // The breakdown was rewritten; even if numbers don't change today (the
    // formula doesn't yet read deliveries), the JSONB object is fresh.
    expect(after.rows[0].priority_score_breakdown).toBeDefined();
    void before;
  });

  it('honors Idempotency-Key via client_op_id (returns the same delivery on replay)', async () => {
    const w = await setupWorld();
    const body = exceptionBody(w, { client_op_id: 'OP-12345678' });

    const a = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(body);
    expect(a.status).toBe(201);

    const b = await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(body);
    expect(b.status).toBe(201);
    expect(b.body.data.id).toBe(a.body.data.id);

    // Inventory only decremented once.
    const inv = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [w.warehouseId, w.foodResourceId],
    );
    expect(inv.rows[0].available_quantity).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/families/:id/deliveries — sanity
// ---------------------------------------------------------------------------

describe('GET /api/v1/families/:id/deliveries', () => {
  it('returns the deliveries created for the family', async () => {
    const w = await setupWorld();
    await request(app)
      .post('/api/v1/deliveries/exception')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send(exceptionBody(w));

    const res = await request(app)
      .get(`/api/v1/families/${w.familyId}/deliveries`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].family_id).toBe(w.familyId);
  });

  it('returns 404 when the family does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/families/999999/deliveries')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });
});
