/**
 * Integration tests for /api/v1/audit-logs (Issue #47, HU-31, RNF-09).
 *
 * Verifica:
 *   1. GET /audit-logs accesible solo a ADMIN y FUNCIONARIO_CONTROL.
 *   2. Crear una donación genera entrada en audit_logs (action='CREATE', module='donations').
 *   3. GET /audit-logs devuelve lista paginada con filtros.
 *   4. UPDATE manual de audit_logs falla con error de inmutabilidad.
 *   5. DELETE manual de audit_logs falla con error de inmutabilidad.
 *
 * Requiere BD viva con migraciones 001-019 aplicadas y `pnpm db:seed`.
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
let controlToken: string;
let censadorToken: string;
let coordinatorToken: string;

beforeAll(async () => {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE email = 'admin@sigah.gov.co' LIMIT 1`,
  );
  if (!rows[0]) throw new Error('Run `pnpm db:seed` before integration tests.');
  adminUserId = rows[0].id;

  const sign = (role: string, id = adminUserId) =>
    jwt.sign({ id, email: 'admin@sigah.gov.co', role }, JWT_SECRET, { expiresIn: '1h' });

  adminToken = sign('ADMIN');
  controlToken = sign('FUNCIONARIO_CONTROL');
  censadorToken = sign('CENSADOR');
  coordinatorToken = sign('COORDINADOR_LOGISTICA');
});

// ---------------------------------------------------------------------------
// Helper: crea zona + almacén + tipo de recurso + donante + donación (para
// ejercer sp_donations_create y generar una entrada en audit_logs).
// ---------------------------------------------------------------------------
async function createDonation(): Promise<number> {
  // Zona
  const zRes = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Zona Audit', risk_level: 'LOW', latitude: 10, longitude: -74, estimated_population: 100 });
  const zoneId: number = zRes.body.data.id;

  // Almacén
  const wRes = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Bodega Audit', address: 'Calle 1', zone_id: zoneId, max_capacity_kg: 500, latitude: 10, longitude: -74 });
  const warehouseId: number = wRes.body.data.id;

  // Tipo de recurso
  const rtRes = await request(app)
    .post('/api/v1/resource-types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Arroz Audit', category: 'FOOD', unit_of_measure: 'kg', unit_weight_kg: 1 });
  const resourceTypeId: number = rtRes.body.data.id;

  // Donante
  const donorRes = await request(app)
    .post('/api/v1/donors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Donante Audit', type: 'PERSONA_NATURAL', contact: 'test@audit.co' });
  const donorId: number = donorRes.body.data.id;

  // Donación
  const donRes = await request(app)
    .post('/api/v1/donations')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      donor_id: donorId,
      destination_warehouse_id: warehouseId,
      donation_type: 'IN_KIND',
      details: [{ resource_type_id: resourceTypeId, quantity: 10, weight_kg: 10 }],
    });

  return donRes.body.data.id as number;
}

// ---------------------------------------------------------------------------
// AC1: GET protegido — solo ADMIN y FUNCIONARIO_CONTROL
// ---------------------------------------------------------------------------
describe('GET /api/v1/audit-logs — RBAC', () => {
  it('debería devolver 200 a ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('debería devolver 200 a FUNCIONARIO_CONTROL', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${controlToken}`);
    expect(res.status).toBe(200);
  });

  it('debería devolver 403 a CENSADOR', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${censadorToken}`);
    expect(res.status).toBe(403);
  });

  it('debería devolver 403 a COORDINADOR_LOGISTICA', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(res.status).toBe(403);
  });

  it('debería devolver 401 sin token', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC2: mutación → genera entrada en audit_logs
// ---------------------------------------------------------------------------
describe('audit_logs — registro de mutaciones', () => {
  it('crear una donación genera entrada con action=CREATE, module=donations', async () => {
    await createDonation();

    const { rows } = await pool.query<{ action: string; module: string; after: unknown }>(
      `SELECT action, module, after FROM audit_logs WHERE module = 'donations' AND action = 'CREATE' LIMIT 1`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].action).toBe('CREATE');
    expect(rows[0].module).toBe('donations');
    expect(rows[0].after).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC3: GET con filtros — paginación y filtros opcionales
// ---------------------------------------------------------------------------
describe('GET /api/v1/audit-logs — filtros y paginación', () => {
  it('devuelve paginación correcta', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(5);
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('filtra por module=donations', async () => {
    await createDonation();

    const res = await request(app)
      .get('/api/v1/audit-logs?module=donations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const entry of res.body.data as Array<{ module: string }>) {
      expect(entry.module).toBe('donations');
    }
  });

  it('filtra por action=CREATE', async () => {
    await createDonation();

    const res = await request(app)
      .get('/api/v1/audit-logs?action=CREATE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const entry of res.body.data as Array<{ action: string }>) {
      expect(entry.action).toBe('CREATE');
    }
  });
});

// ---------------------------------------------------------------------------
// AC4 & AC5: inmutabilidad — UPDATE y DELETE manuales deben fallar
// ---------------------------------------------------------------------------
describe('audit_logs — inmutabilidad (triggers)', () => {
  it('intentar UPDATE manual debe fallar con excepción del trigger', async () => {
    // Insertar una fila directamente
    await pool.query(
      `INSERT INTO audit_logs (action, module, entity, entity_id, user_id) VALUES ('TEST_IMMUTABLE', 'test', 'Test', 0, NULL)`,
    );
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM audit_logs WHERE action = 'TEST_IMMUTABLE' LIMIT 1`,
    );
    expect(rows.length).toBe(1);
    const id = rows[0].id;

    // Intentar UPDATE — debe fallar
    await expect(
      pool.query(`UPDATE audit_logs SET action = 'HACK' WHERE id = $1`, [id]),
    ).rejects.toThrow();
  });

  it('intentar DELETE manual debe fallar con excepción del trigger', async () => {
    await pool.query(
      `INSERT INTO audit_logs (action, module, entity, entity_id, user_id) VALUES ('TEST_DELETE', 'test', 'Test', 0, NULL)`,
    );
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM audit_logs WHERE action = 'TEST_DELETE' LIMIT 1`,
    );
    const id = rows[0].id;

    // Intentar DELETE — debe fallar
    await expect(
      pool.query(`DELETE FROM audit_logs WHERE id = $1`, [id]),
    ).rejects.toThrow();
  });
});
