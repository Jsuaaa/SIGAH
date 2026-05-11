/**
 * Integration tests for /api/v1/sync and Idempotency-Key middleware.
 *
 * Hits the Express app via supertest. Requires a live PostgreSQL database;
 * cleanup between tests is handled by the afterEach hook in ../setup.ts.
 *
 * References: Issue #32 / GH #48 — PWA offline sync backend.
 */
import '../setup';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { pool } from '../setup';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from '../../src/app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';

function makeToken(role: string, id = 9999): string {
  return jwt.sign(
    { id, email: `test-${role.toLowerCase()}@sigah.test`, role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const adminToken = makeToken('ADMIN');
const censadorToken = makeToken('CENSADOR', 8888);
const operatorToken = makeToken('OPERADOR_ENTREGAS', 7777);

// ---------------------------------------------------------------------------
// Helpers to create prerequisite data
// ---------------------------------------------------------------------------

async function createZone(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Sync Test',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 3000,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createFamily(zoneId: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${censadorToken}`)
    .send({
      head_document: `DOC-SYNC-${Date.now()}`,
      zone_id: zoneId,
      num_members: 3,
      privacy_consent_accepted: true,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function opId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// GET /sync/status
// ---------------------------------------------------------------------------

describe('GET /api/v1/sync/status', () => {
  it('returns sync statistics for the user (empty state)', async () => {
    const res = await request(app)
      .get('/api/v1/sync/status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      last_processed_at: null,
      total_ops: 0,
      ops_today: 0,
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/sync/status');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /sync — batch ops
// ---------------------------------------------------------------------------

describe('POST /api/v1/sync — batch processing', () => {
  it('rejects empty ops array', async () => {
    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ops: [] });

    expect(res.status).toBe(400);
  });

  it('rejects missing ops field', async () => {
    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/sync')
      .send({ ops: [{ client_op_id: 'abc12345', method: 'POST', url: '/api/v1/families', payload: {} }] });

    expect(res.status).toBe(401);
  });

  it('processes a family creation op successfully', async () => {
    const zoneId = await createZone();
    const clientOpId = opId();

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ops: [
          {
            client_op_id: clientOpId,
            method: 'POST',
            url: '/api/v1/families',
            payload: {
              head_document: `DOC-BATCH-${Date.now()}`,
              zone_id: zoneId,
              num_members: 2,
              privacy_consent_accepted: true,
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);

    const opResult = res.body.data[0];
    expect(opResult.client_op_id).toBe(clientOpId);
    expect(opResult.status_code).toBe(201);
    expect(opResult.from_cache).toBe(false);
    expect(opResult.response.success).toBe(true);
  });

  it('returns cached result on duplicate client_op_id (deduplication)', async () => {
    const zoneId = await createZone();
    const clientOpId = opId();

    const payload = {
      ops: [
        {
          client_op_id: clientOpId,
          method: 'POST',
          url: '/api/v1/families',
          payload: {
            head_document: `DOC-DUP-${Date.now()}`,
            zone_id: zoneId,
            num_members: 4,
            privacy_consent_accepted: true,
          },
        },
      ],
    };

    // First call — creates the family
    const res1 = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body.data[0].from_cache).toBe(false);
    const firstFamilyId: number = res1.body.data[0].response.data.id;

    // Second call with same client_op_id — must NOT create a duplicate family
    const res2 = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.data[0].from_cache).toBe(true);
    expect(res2.body.data[0].response.data.id).toBe(firstFamilyId);

    // Verify only 1 entry in sync_log for this op_id
    const { rows } = await pool.query(
      'SELECT count(*) FROM sync_log WHERE client_op_id = $1',
      [clientOpId],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it('processes unsupported URL and returns 422 (not 500)', async () => {
    const clientOpId = opId();

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ops: [
          {
            client_op_id: clientOpId,
            method: 'POST',
            url: '/api/v1/unknown-endpoint',
            payload: {},
          },
        ],
      });

    expect(res.status).toBe(200); // batch always returns 200; per-op errors in body
    expect(res.body.data[0].status_code).toBe(422);
    expect(res.body.data[0].response.success).toBe(false);
  });

  it('GET /sync/status reflects ops recorded by batch', async () => {
    const zoneId = await createZone();

    // Insert 2 ops
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/v1/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ops: [
            {
              client_op_id: opId(),
              method: 'POST',
              url: '/api/v1/families',
              payload: {
                head_document: `DOC-STATUS-${Date.now()}-${i}`,
                zone_id: zoneId,
                num_members: 1,
                privacy_consent_accepted: true,
              },
            },
          ],
        });
    }

    const statusRes = await request(app)
      .get('/api/v1/sync/status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.total_ops).toBeGreaterThanOrEqual(2);
    expect(statusRes.body.data.ops_today).toBeGreaterThanOrEqual(2);
    expect(statusRes.body.data.last_processed_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Idempotency-Key middleware — POST /deliveries
// ---------------------------------------------------------------------------

describe('Idempotency-Key header on POST /api/v1/deliveries', () => {
  // These tests require a full delivery setup (zone, family, warehouse, inventory).
  // We verify the middleware does NOT interfere when no key is present, and
  // returns cached response on the second request with the same key.

  it('POST /deliveries without Idempotency-Key passes through normally', async () => {
    // We expect a 4xx because we have no real warehouse/family in this scope —
    // the key point is that the middleware does not block the request.
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        family_id: 99999,
        source_warehouse_id: 99999,
        coverage_days: 7,
        details: [{ resource_type_id: 1, quantity: 1 }],
      });

    // The SP should raise a 404/422/409 — NOT a middleware-level block.
    expect([400, 404, 409, 422, 500]).toContain(res.status);
  });

  it('POST /families with Idempotency-Key caches and deduplicates', async () => {
    const zoneId = await createZone();
    const key = opId();
    const headDoc = `DOC-IDEM-${Date.now()}`;

    const body = {
      head_document: headDoc,
      zone_id: zoneId,
      num_members: 2,
      privacy_consent_accepted: true,
    };

    // First call — creates family
    const res1 = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${censadorToken}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(res1.status).toBe(201);
    const firstId: number = res1.body.data.id;

    // Second call with same key — must return same body, not create a duplicate
    const res2 = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${censadorToken}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(res2.status).toBe(201);
    expect(res2.body.data.id).toBe(firstId);

    // Verify only 1 family with this head_document
    const { rows } = await pool.query(
      `SELECT count(*) FROM families WHERE head_document = $1`,
      [headDoc],
    );
    expect(Number(rows[0].count)).toBe(1);
  });
});
