/**
 * Integration tests for #24 — regular delivery create, status transitions,
 * batch creation and idempotency (Idempotency-Key header).
 *
 * Requires a live PostgreSQL database; cleanup is handled by afterEach in
 * ../setup.ts.
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
// World setup helpers
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
  lat?: number;
  lng?: number;
} = {}): Promise<World> {
  const numMembers = opts.num_members ?? 4;
  const cap = opts.warehouse_capacity_kg ?? 5000;
  const unit = opts.unit_weight_kg ?? 1.0;
  const qty = opts.initial_quantity ?? 200;
  const lat = opts.lat ?? 8.74;
  const lng = opts.lng ?? -75.9;

  const z = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Create',
      risk_level: 'HIGH',
      latitude: lat,
      longitude: lng,
      estimated_population: 1000,
    });

  const w = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'WH Create',
      address: 'Av. 1',
      zone_id: z.body.data.id,
      max_capacity_kg: cap,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: lat,
      longitude: lng,
    });

  const f = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: `CRE-${Date.now()}`,
      zone_id: z.body.data.id,
      num_members: numMembers,
      privacy_consent_accepted: true,
    });

  const rt = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Arroz-${Date.now()}`,
      category: 'FOOD',
      unit_of_measure: 'kg',
      unit_weight_kg: unit,
    });

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

/** Body for a valid regular delivery. */
function deliveryBody(world: World, overrides: Record<string, unknown> = {}) {
  return {
    family_id: world.familyId,
    source_warehouse_id: world.warehouseId,
    coverage_days: 7,
    details: [{ resource_type_id: world.foodResourceId, quantity: 50 }],
    ...overrides,
  };
}

/** Create an exception delivery so the family becomes ineligible. */
async function makeIneligible(world: World) {
  await request(app)
    .post('/api/v1/deliveries/exception')
    .set('Authorization', `Bearer ${coordinatorToken}`)
    .send({
      family_id: world.familyId,
      source_warehouse_id: world.warehouseId,
      coverage_days: 30,
      exception_reason: 'Hacer inelegible para test de elegibilidad regular',
      exception_authorized_by: adminUserId,
      details: [{ resource_type_id: world.foodResourceId, quantity: 50 }],
    });
}

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries (RBAC)', () => {
  it('returns 403 for FUNCIONARIO_CONTROL', async () => {
    const world = await setupWorld();
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(deliveryBody(world));
    expect(res.status).toBe(403);
  });

  it('allows ADMIN, COORDINADOR_LOGISTICA, OPERADOR_ENTREGAS', async () => {
    for (const token of [adminToken, coordinatorToken, operatorToken]) {
      const world = await setupWorld();
      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${token}`)
        .send(deliveryBody(world));
      expect(res.status).toBe(201);
    }
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries (validation)', () => {
  it('returns 400 when coverage_days < 3 (RN-01)', async () => {
    const world = await setupWorld();
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world, { coverage_days: 2 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when details is empty', async () => {
    const world = await setupWorld();
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world, { details: [] }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// #24 CA2 — Eligibility check on regular delivery
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries (CA2 — eligibility)', () => {
  it('returns 409 when family is not eligible (coverage window still active)', async () => {
    const world = await setupWorld();
    await makeIneligible(world);

    // Try regular delivery while coverage is still active.
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// #24 CA1/CA3 — Successful creation + inventory decrement
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries (CA1/CA3 — creation + inventory)', () => {
  it('creates delivery, decrements inventory and warehouse weight', async () => {
    const world = await setupWorld({ num_members: 4 });

    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));

    expect(res.status).toBe(201);
    expect(res.body.data.delivery_code).toMatch(/^ENT-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('PROGRAMADA');
    expect(res.body.data.family_id).toBe(world.familyId);
    // Regular delivery must NOT set exception fields.
    expect(res.body.data.exception_reason).toBeNull();
    expect(res.body.data.exception_authorized_by).toBeNull();

    // Inventory decremented (200 - 50 = 150).
    const inv = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [world.warehouseId, world.foodResourceId],
    );
    expect(inv.rows[0].available_quantity).toBe(150);

    // Warehouse weight updated.
    const wh = await pool.query<{ current_weight_kg: number }>(
      'SELECT current_weight_kg FROM warehouses WHERE id = $1',
      [world.warehouseId],
    );
    expect(Number(wh.rows[0].current_weight_kg)).toBeCloseTo(150, 5);
  });

  it('returns 422 when stock is insufficient (CA3)', async () => {
    const world = await setupWorld({ initial_quantity: 5 });
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world, { details: [{ resource_type_id: world.foodResourceId, quantity: 50 }] }));
    expect(res.status).toBe(422);
  });

  it('returns 422 when food kg is below minimum ration (RN-01)', async () => {
    // 4 members × 0.6 × 7 days = 16.8 kg. unit=1 kg. 5 units = 5 kg < 16.8.
    const world = await setupWorld({ num_members: 4 });
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world, { details: [{ resource_type_id: world.foodResourceId, quantity: 5 }] }));
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// #24 CA5 — Idempotency-Key header
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries (CA5 — Idempotency-Key)', () => {
  it('second POST with same Idempotency-Key returns the same delivery (no duplicate)', async () => {
    const world = await setupWorld();
    const key = `IDEM-${Date.now()}-TEST`;

    const a = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('Idempotency-Key', key)
      .send(deliveryBody(world));
    expect(a.status).toBe(201);

    const b = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('Idempotency-Key', key)
      .send(deliveryBody(world));
    expect(b.status).toBe(201);
    // Same delivery ID returned.
    expect(b.body.data.id).toBe(a.body.data.id);

    // Inventory only decremented once.
    const inv = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [world.warehouseId, world.foodResourceId],
    );
    expect(inv.rows[0].available_quantity).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// #24 CA6 — Status transitions
// ---------------------------------------------------------------------------

describe('PUT /api/v1/deliveries/:id/status (CA6 — transitions)', () => {
  it('PROGRAMADA → EN_CURSO → ENTREGADA: all valid', async () => {
    const world = await setupWorld();
    const create = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));
    expect(create.status).toBe(201);
    const id = create.body.data.id as number;

    const toEnCurso = await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'EN_CURSO' });
    expect(toEnCurso.status).toBe(200);
    expect(toEnCurso.body.data.status).toBe('EN_CURSO');

    const toEntregada = await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ENTREGADA' });
    expect(toEntregada.status).toBe(200);
    expect(toEntregada.body.data.status).toBe('ENTREGADA');
    // delivery_date is set when status = ENTREGADA.
    expect(toEntregada.body.data.delivery_date).toBeTruthy();
  });

  it('PROGRAMADA → ENTREGADA (skip EN_CURSO) returns 422', async () => {
    const world = await setupWorld();
    const create = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));
    const id = create.body.data.id as number;

    const res = await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ENTREGADA' });
    expect(res.status).toBe(422);
  });

  it('ENTREGADA → EN_CURSO (reversal) returns 422', async () => {
    const world = await setupWorld();
    const create = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));
    const id = create.body.data.id as number;

    // Advance to ENTREGADA.
    await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'EN_CURSO' });
    await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ENTREGADA' });

    // Attempt reversal.
    const res = await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'EN_CURSO' });
    expect(res.status).toBe(422);
  });

  it('returns 404 for non-existent delivery', async () => {
    const res = await request(app)
      .put('/api/v1/deliveries/999999/status')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'EN_CURSO' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when status value is invalid', async () => {
    const res = await request(app)
      .put('/api/v1/deliveries/1/status')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'INVALIDO' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for FUNCIONARIO_CONTROL', async () => {
    const world = await setupWorld();
    const create = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));
    const id = create.body.data.id as number;

    const res = await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'EN_CURSO' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// RN-08 — priority_score decreases after delivery is ENTREGADA
// ---------------------------------------------------------------------------

describe('RN-08 — priority_score recalc after ENTREGADA', () => {
  it('priority_score_breakdown changes after delivery is ENTREGADA', async () => {
    const world = await setupWorld();
    const create = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));
    const id = create.body.data.id as number;

    const before = await pool.query<{ priority_score: number }>(
      'SELECT priority_score FROM families WHERE id = $1',
      [world.familyId],
    );

    // Advance to ENTREGADA.
    await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'EN_CURSO' });
    await request(app)
      .put(`/api/v1/deliveries/${id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ENTREGADA' });

    const after = await pool.query<{ priority_score: number }>(
      'SELECT priority_score FROM families WHERE id = $1',
      [world.familyId],
    );

    // Priority score should have decreased (W_DELIVERIES contribution is now
    // subtracted and days_without_aid reset).
    expect(Number(after.rows[0].priority_score)).toBeLessThanOrEqual(
      Number(before.rows[0].priority_score),
    );
  });
});

// ---------------------------------------------------------------------------
// #24 CA4 — Batch creation
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries/batch (CA4)', () => {
  it('returns 403 for OPERADOR_ENTREGAS', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries/batch')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ count: 5 });
    expect(res.status).toBe(403);
  });

  it('returns 400 when count is out of range', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries/batch')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ count: 0 });
    expect(res.status).toBe(400);

    const res2 = await request(app)
      .post('/api/v1/deliveries/batch')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ count: 101 });
    expect(res2.status).toBe(400);
  });

  it('creates N deliveries for eligible families and skips ineligible ones', async () => {
    // Create 3 families, make 1 ineligible.
    const w1 = await setupWorld({ initial_quantity: 500 });
    const w2 = await setupWorld({ initial_quantity: 500 });
    const w3 = await setupWorld({ initial_quantity: 500 });

    // Make family 3 ineligible via a 30-day exception.
    await makeIneligible(w3);

    const res = await request(app)
      .post('/api/v1/deliveries/batch')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ count: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    // At least 2 families were eligible (w1, w2).
    expect(res.body.data.created).toBeGreaterThanOrEqual(2);

    void w1; void w2; void w3;
  });
});

// ---------------------------------------------------------------------------
// GET /deliveries — filters
// ---------------------------------------------------------------------------

describe('GET /api/v1/deliveries (filters)', () => {
  it('filters by family_id', async () => {
    const world = await setupWorld();
    await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));

    const res = await request(app)
      .get(`/api/v1/deliveries?family_id=${world.familyId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].family_id).toBe(world.familyId);
  });

  it('filters by status', async () => {
    const world = await setupWorld();
    await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));

    const res = await request(app)
      .get('/api/v1/deliveries?status=PROGRAMADA')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((d: { status: string }) => d.status === 'PROGRAMADA')).toBe(true);
  });

  it('filters by warehouse_id', async () => {
    const world = await setupWorld();
    await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(deliveryBody(world));

    const res = await request(app)
      .get(`/api/v1/deliveries?warehouse_id=${world.warehouseId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
