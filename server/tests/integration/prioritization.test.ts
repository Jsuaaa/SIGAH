/**
 * Integration tests for /api/v1/prioritization (HU-08, HU-21).
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
import { invalidateCache } from '../../src/services/scoringConfig.service';

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

// Restore the seeded W_CHILDREN_5 after tests that mutate it.
afterEach(async () => {
  await pool.query(
    `UPDATE scoring_config SET value = 5 WHERE key = 'W_CHILDREN_5'`,
  );
  invalidateCache();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createZone(name: string, risk = 'HIGH'): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      risk_level: risk,
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  return res.body.data.id as number;
}

async function createFamily(
  zone_id: number,
  head_document: string,
  status: string = 'ACTIVO',
): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document,
      zone_id,
      num_members: 1,
      status,
      privacy_consent_accepted: true,
    });
  return res.body.data.id as number;
}

// ---------------------------------------------------------------------------
// GET /ranking
// ---------------------------------------------------------------------------

describe('GET /api/v1/prioritization/ranking', () => {
  it('orders families by priority_score DESC and includes breakdown', async () => {
    const lowZ = await createZone('Z-Low', 'LOW');
    const critZ = await createZone('Z-Crit', 'CRITICAL');
    await createFamily(lowZ, 'L-1');
    await createFamily(critZ, 'C-1');

    const res = await request(app)
      .get('/api/v1/prioritization/ranking')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    // First row should be the CRITICAL-zone family.
    expect(res.body.data[0].zone_name).toBe('Z-Crit');
    expect(res.body.data[0].priority_score_breakdown).toBeDefined();
    expect(res.body.data[0].priority_score).toBeGreaterThanOrEqual(
      res.body.data[1].priority_score,
    );
  });

  it('filters by zone_id and status', async () => {
    const a = await createZone('Z-A');
    const b = await createZone('Z-B');
    await createFamily(a, 'A-1');
    await createFamily(b, 'B-1', 'EVACUADO');

    const res = await request(app)
      .get(`/api/v1/prioritization/ranking?zone_id=${b}&status=EVACUADO`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].zone_id).toBe(b);
    expect(res.body.data[0].status).toBe('EVACUADO');
  });

  it('exposes last_delivery_date as null until #22 lands', async () => {
    const z = await createZone('Z-LD');
    await createFamily(z, 'LD-1');

    const res = await request(app)
      .get('/api/v1/prioritization/ranking')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.body.data[0].last_delivery_date).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /recalculate
// ---------------------------------------------------------------------------

describe('POST /api/v1/prioritization/recalculate', () => {
  it('returns 403 when role is VIEWER', async () => {
    const res = await request(app)
      .post('/api/v1/prioritization/recalculate')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();
    expect(res.status).toBe(403);
  });

  it('recomputes scores using the latest weights', async () => {
    const z = await createZone('Z-Re');
    const fId = await createFamily(z, 'RE-1');

    // Read the initial score (computed at creation with seeded weights).
    const before = await pool.query<{ priority_score: number }>(
      'SELECT priority_score FROM families WHERE id = $1',
      [fId],
    );

    // Bump W_MEMBERS so the score must change after recompute.
    await pool.query(`UPDATE scoring_config SET value = 100 WHERE key = 'W_MEMBERS'`);

    const res = await request(app)
      .post('/api/v1/prioritization/recalculate')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.data.recalculated).toBeGreaterThanOrEqual(1);

    const after = await pool.query<{ priority_score: number }>(
      'SELECT priority_score FROM families WHERE id = $1',
      [fId],
    );
    expect(after.rows[0].priority_score).toBeGreaterThan(before.rows[0].priority_score);

    // Restore so afterEach doesn't have to.
    await pool.query(`UPDATE scoring_config SET value = 2 WHERE key = 'W_MEMBERS'`);
  });
});

// ---------------------------------------------------------------------------
// GET /next-batch
// ---------------------------------------------------------------------------

describe('GET /api/v1/prioritization/next-batch', () => {
  it('returns top N eligible families sorted by score desc', async () => {
    const lowZ = await createZone('NB-Low', 'LOW');
    const critZ = await createZone('NB-Crit', 'CRITICAL');
    await createFamily(lowZ, 'NB-L');
    await createFamily(critZ, 'NB-C');

    const res = await request(app)
      .get('/api/v1/prioritization/next-batch?count=1')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].zone_name).toBe('NB-Crit');
    expect(res.body.data[0].eligibility.is_eligible).toBe(true);
  });

  it('clamps count to a sane positive value when missing', async () => {
    const z = await createZone('NB-Default');
    await createFamily(z, 'NB-D-1');
    const res = await request(app)
      .get('/api/v1/prioritization/next-batch')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 when count is invalid', async () => {
    const res = await request(app)
      .get('/api/v1/prioritization/next-batch?count=-5')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(400);
  });
});
