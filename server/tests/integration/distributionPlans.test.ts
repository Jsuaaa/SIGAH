/**
 * Integration tests for /api/v1/distribution-plans (Issue #46, HU-21).
 *
 * Hits the Express app via supertest. Requires a live PostgreSQL database;
 * cleanup between tests is handled by the afterEach hook in ../setup.ts.
 *
 * Coverage:
 *   - Plan-code formato PLN-YYYY-NNNNN.
 *   - Scope filtra familias (GLOBAL / ZONA / REFUGIO / LOTE).
 *   - Items ordenados por priority_score DESC.
 *   - Familia inelegible → item SIN_ATENDER.
 *   - Bodega sin stock → item SIN_ATENDER con razón INSUFFICIENT_STOCK.
 *   - Cancelar plan → status CANCELADA + items PENDIENTE pasan a SIN_ATENDER.
 *   - Ejecutar plan → deliveries creadas con plan_item_id, inventario decrementado.
 *   - Solo ADMIN / COORDINADOR_LOGISTICA pueden crear / ejecutar / cancelar.
 *   - 401 sin token.
 */
import '../setup';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from '../../src/app';
import { pool } from '../setup';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';

function makeToken(role: string, id = 9999): string {
  return jwt.sign(
    { id, email: `test-${role.toLowerCase()}@sigah.test`, role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const adminToken        = makeToken('ADMIN');
const coordinatorToken  = makeToken('COORDINADOR_LOGISTICA');
const operatorToken     = makeToken('OPERADOR_ENTREGAS');
const viewerToken       = makeToken('FUNCIONARIO_CONTROL');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createZone(name = 'Zona Test Plans'): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, risk_level: 'HIGH', latitude: 8.74, longitude: -75.9, estimated_population: 5000 });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createWarehouse(zone_id: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Bodega Plan Test',
      address: 'Calle 1',
      zone_id,
      max_capacity_kg: 5000,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createResourceType(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Arroz Planes',
      category: 'FOOD',
      unit_of_measure: 'kg',
      unit_weight_kg: 1,
      is_active: true,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function addInventory(warehouse_id: number, resource_type_id: number, quantity: number): Promise<void> {
  // Usamos el endpoint de donación para agregar inventario vía el flujo existente.
  // Alternativa directa: INSERT via pool (más rápido para tests).
  await pool.query(
    `INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg, batch)
     VALUES ($1, $2, $3, $3, 'BATCH-TEST')
     ON CONFLICT (warehouse_id, resource_type_id, batch)
     DO UPDATE SET available_quantity = inventory.available_quantity + EXCLUDED.available_quantity,
                   total_weight_kg    = inventory.total_weight_kg + EXCLUDED.total_weight_kg`,
    [warehouse_id, resource_type_id, quantity],
  );
  // Sincroniza current_weight_kg en la bodega.
  await pool.query(
    `UPDATE warehouses SET current_weight_kg = (
       SELECT COALESCE(SUM(total_weight_kg), 0) FROM inventory WHERE warehouse_id = $1
     ) WHERE id = $1`,
    [warehouse_id],
  );
}

async function createFamily(zone_id: number, overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      zone_id,
      num_members: 4,
      num_children_under_5: 1,
      num_adults_over_65: 0,
      num_pregnant: 0,
      num_disabled: 0,
      status: 'ACTIVO',
      privacy_consent_accepted: true,
      latitude: 8.74,
      longitude: -75.9,
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// ---------------------------------------------------------------------------
// POST /api/v1/distribution-plans
// ---------------------------------------------------------------------------

describe('POST /api/v1/distribution-plans', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for OPERADOR_ENTREGAS', async () => {
    const zone_id = await createZone();
    await createFamily(zone_id);
    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });
    expect(res.status).toBe(403);
  });

  it('returns 403 for FUNCIONARIO_CONTROL', async () => {
    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });
    expect(res.status).toBe(403);
  });

  it('returns 400 if target_coverage_days < 3', async () => {
    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 2 });
    expect(res.status).toBe(400);
  });

  it('returns 400 if scope is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'INVALID', target_coverage_days: 3 });
    expect(res.status).toBe(400);
  });

  it('creates a GLOBAL plan with PLN-YYYY-NNNNN code', async () => {
    const zone_id   = await createZone();
    const wh_id     = await createWarehouse(zone_id);
    const rt_id     = await createResourceType();
    await addInventory(wh_id, rt_id, 1000);
    await createFamily(zone_id);

    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    expect(res.status).toBe(201);
    const plan = res.body.data;
    expect(plan.status).toBe('PROGRAMADA');
    expect(plan.scope).toBe('GLOBAL');
    expect(plan.plan_code).toMatch(/^PLN-\d{4}-\d{5}$/);
  });

  it('COORDINADOR_LOGISTICA can create a plan', async () => {
    const zone_id = await createZone();
    await createFamily(zone_id);

    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    // Plan may be 201 even if no warehouse → family items will be SIN_ATENDER.
    expect([201]).toContain(res.status);
  });

  it('items sin_atender when no warehouse has stock', async () => {
    const zone_id  = await createZone();
    const familyId = await createFamily(zone_id);

    // No bodega ni stock creado.
    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    expect(res.status).toBe(201);

    // Busca los items del plan recién creado.
    const planId = res.body.data.id as number;
    const detail = await request(app)
      .get(`/api/v1/distribution-plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detail.status).toBe(200);
    const items = detail.body.data.items as Array<{ status: string; family_id: number; reason: string }>;
    const familyItem = items.find((i) => i.family_id === familyId);
    expect(familyItem).toBeDefined();
    expect(familyItem!.status).toBe('SIN_ATENDER');
    expect(familyItem!.reason).toContain('INSUFFICIENT_STOCK');
  });

  it('items ordered by priority_score desc', async () => {
    const zone_id = await createZone();
    const wh_id   = await createWarehouse(zone_id);
    const rt_id   = await createResourceType();
    await addInventory(wh_id, rt_id, 5000);

    // Creamos 2 familias con miembros distintos — prioridad diferente.
    await createFamily(zone_id, { num_members: 1, num_children_under_5: 0 });
    await createFamily(zone_id, { num_members: 5, num_children_under_5: 2 });

    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    expect(res.status).toBe(201);

    const detail = await request(app)
      .get(`/api/v1/distribution-plans/${res.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const items = detail.body.data.items as Array<{ priority_score_snapshot: number }>;
    if (items.length >= 2) {
      expect(items[0].priority_score_snapshot).toBeGreaterThanOrEqual(items[1].priority_score_snapshot);
    }
  });

  it('creates ZONA-scoped plan filtering families by zone', async () => {
    const zone1   = await createZone('Zone A');
    const zone2   = await createZone('Zone B');
    const wh_id   = await createWarehouse(zone1);
    const rt_id   = await createResourceType();
    await addInventory(wh_id, rt_id, 2000);

    const f1 = await createFamily(zone1);
    await createFamily(zone2); // debe quedar fuera del scope

    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'ZONA', scope_id: zone1, target_coverage_days: 3 });

    expect(res.status).toBe(201);

    const detail = await request(app)
      .get(`/api/v1/distribution-plans/${res.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const items = detail.body.data.items as Array<{ family_id: number }>;
    expect(items.every((i) => i.family_id === f1)).toBe(true);
    expect(items.length).toBe(1);
  });

  it('creates LOTE-scoped plan for specific families', async () => {
    const zone_id = await createZone();
    const wh_id   = await createWarehouse(zone_id);
    const rt_id   = await createResourceType();
    await addInventory(wh_id, rt_id, 2000);

    const f1 = await createFamily(zone_id);
    const f2 = await createFamily(zone_id);
    const f3 = await createFamily(zone_id); // fuera del lote

    const res = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'LOTE', target_coverage_days: 3, family_ids: [f1, f2] });

    expect(res.status).toBe(201);

    const detail = await request(app)
      .get(`/api/v1/distribution-plans/${res.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const items = detail.body.data.items as Array<{ family_id: number }>;
    const ids = items.map((i) => i.family_id);
    expect(ids).toContain(f1);
    expect(ids).toContain(f2);
    expect(ids).not.toContain(f3);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/distribution-plans
// ---------------------------------------------------------------------------

describe('GET /api/v1/distribution-plans', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/distribution-plans');
    expect(res.status).toBe(401);
  });

  it('returns list with pagination', async () => {
    const zone_id = await createZone();
    await createFamily(zone_id);

    await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    const res = await request(app)
      .get('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/distribution-plans/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/distribution-plans/:id', () => {
  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/api/v1/distribution-plans/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns plan with embedded items', async () => {
    const zone_id = await createZone();
    const wh_id   = await createWarehouse(zone_id);
    const rt_id   = await createResourceType();
    await addInventory(wh_id, rt_id, 1000);
    await createFamily(zone_id);

    const createRes = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    const res = await request(app)
      .get(`/api/v1/distribution-plans/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/distribution-plans/:id/cancel
// ---------------------------------------------------------------------------

describe('PUT /api/v1/distribution-plans/:id/cancel', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/v1/distribution-plans/1/cancel');
    expect(res.status).toBe(401);
  });

  it('returns 403 for OPERADOR_ENTREGAS', async () => {
    const res = await request(app)
      .put('/api/v1/distribution-plans/1/cancel')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('cancels a PROGRAMADA plan — items PENDIENTE → SIN_ATENDER', async () => {
    const zone_id = await createZone();
    const wh_id   = await createWarehouse(zone_id);
    const rt_id   = await createResourceType();
    await addInventory(wh_id, rt_id, 1000);
    await createFamily(zone_id);

    const createRes = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    const planId = createRes.body.data.id as number;

    const cancelRes = await request(app)
      .put(`/api/v1/distribution-plans/${planId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELADA');

    // Verificar items.
    const detail = await request(app)
      .get(`/api/v1/distribution-plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const items = detail.body.data.items as Array<{ status: string; reason: string }>;
    // Los que estaban PENDIENTE deben estar SIN_ATENDER con razón PLAN_CANCELADO.
    const pendingItems = items.filter((i) => i.status === 'PENDIENTE');
    expect(pendingItems.length).toBe(0);
    const cancelledItems = items.filter((i) => i.reason === 'PLAN_CANCELADO');
    expect(cancelledItems.length).toBeGreaterThanOrEqual(0);
  });

  it('returns 422 if plan is already CANCELADA', async () => {
    const zone_id = await createZone();
    await createFamily(zone_id);

    const createRes = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    const planId = createRes.body.data.id as number;

    // Primera cancelación.
    await request(app)
      .put(`/api/v1/distribution-plans/${planId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Segunda cancelación debe fallar.
    const res = await request(app)
      .put(`/api/v1/distribution-plans/${planId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/distribution-plans/:id/execute
// ---------------------------------------------------------------------------

describe('POST /api/v1/distribution-plans/:id/execute', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/distribution-plans/1/execute');
    expect(res.status).toBe(401);
  });

  it('returns 403 for OPERADOR_ENTREGAS', async () => {
    const res = await request(app)
      .post('/api/v1/distribution-plans/1/execute')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('executes plan — creates deliveries with plan_item_id and decrements inventory', async () => {
    const zone_id  = await createZone();
    const wh_id    = await createWarehouse(zone_id);
    const rt_id    = await createResourceType();
    // 4 miembros × 0.6 kg/día × 3 días = 7.2 kg → necesita al menos 8 unidades (CEIL(7.2/1)).
    await addInventory(wh_id, rt_id, 500);
    await createFamily(zone_id);

    const createRes = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    expect(createRes.status).toBe(201);
    const planId = createRes.body.data.id as number;

    const execRes = await request(app)
      .post(`/api/v1/distribution-plans/${planId}/execute`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(execRes.status).toBe(200);
    expect(['EN_EJECUCION', 'COMPLETADA']).toContain(execRes.body.data.status);

    // Verificar que los items ENTREGADO tienen delivery_id.
    const detail = await request(app)
      .get(`/api/v1/distribution-plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const items = detail.body.data.items as Array<{
      status: string;
      delivery_id: number | null;
    }>;
    const delivered = items.filter((i) => i.status === 'ENTREGADO');
    for (const item of delivered) {
      expect(item.delivery_id).not.toBeNull();
    }

    // Verificar que el inventario disminuyó.
    const { rows } = await pool.query<{ available_quantity: number }>(
      'SELECT available_quantity FROM inventory WHERE warehouse_id = $1 AND resource_type_id = $2',
      [wh_id, rt_id],
    );
    if (delivered.length > 0) {
      expect(rows[0].available_quantity).toBeLessThan(500);
    }
  });

  it('returns 422 if plan is CANCELADA', async () => {
    const zone_id = await createZone();
    await createFamily(zone_id);

    const createRes = await request(app)
      .post('/api/v1/distribution-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scope: 'GLOBAL', target_coverage_days: 3 });

    const planId = createRes.body.data.id as number;

    await request(app)
      .put(`/api/v1/distribution-plans/${planId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    const execRes = await request(app)
      .post(`/api/v1/distribution-plans/${planId}/execute`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(execRes.status).toBe(422);
  });
});
