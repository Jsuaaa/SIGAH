/**
 * Integration tests for /api/v1/scoring-config and the cache invalidation
 * path.
 *
 * The scoring_config rows are seeded by migration 008 and survive every
 * `afterEach` (the truncate hook deliberately skips this table). To keep
 * tests independent we restore the original W_CHILDREN_5 value at the end
 * of each block that mutates it.
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

// Reset values touched by each test so the suite is order-independent.
const ORIGINALS: Record<string, number> = {
  W_CHILDREN_5: 5,
  W_MEMBERS: 2,
};

afterEach(async () => {
  for (const [key, value] of Object.entries(ORIGINALS)) {
    await pool.query(
      `UPDATE scoring_config SET value = $1 WHERE key = $2`,
      [value, key],
    );
  }
  invalidateCache();
});

// ---------------------------------------------------------------------------
// GET /api/v1/scoring-config
// ---------------------------------------------------------------------------

describe('GET /api/v1/scoring-config', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/scoring-config');
    expect(res.status).toBe(401);
  });

  it('returns the seeded weights for any authenticated role', async () => {
    const res = await request(app)
      .get('/api/v1/scoring-config')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((r: { key: string }) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'W_MEMBERS',
        'W_CHILDREN_5',
        'W_ADULTS_65',
        'W_PREGNANT',
        'W_DISABLED',
        'W_ZONE_RISK',
        'W_DAYS_NO_AID',
        'W_DELIVERIES',
        'MAX_DAYS',
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/scoring-config
// ---------------------------------------------------------------------------

describe('PUT /api/v1/scoring-config', () => {
  it('returns 403 when role is VIEWER', async () => {
    const res = await request(app)
      .put('/api/v1/scoring-config')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ key: 'W_CHILDREN_5', value: 10 });
    expect(res.status).toBe(403);
  });

  it('returns 400 when key is unknown', async () => {
    const res = await request(app)
      .put('/api/v1/scoring-config')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ key: 'W_PETS', value: 1 });
    expect(res.status).toBe(400);
  });

  it('updates the value and propagates to subsequent priority recomputes', async () => {
    // Setup: a zone + a family. Capture initial priority_score, then update
    // W_CHILDREN_5 and force a recompute by adding a child.
    const z = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Zone Cache',
        risk_level: 'HIGH',
        latitude: 8.74,
        longitude: -75.9,
        estimated_population: 1000,
      });
    const f = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        head_document: 'CACHE-1',
        zone_id: z.body.data.id,
        num_members: 1,
        privacy_consent_accepted: true,
      });
    const familyId = f.body.data.id as number;

    // Bump W_CHILDREN_5 from 5 to 50 so adding a child has a clearly larger
    // delta than the seeded weight.
    const put = await request(app)
      .put('/api/v1/scoring-config')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ key: 'W_CHILDREN_5', value: 50 });
    expect(put.status).toBe(200);
    expect(Number(put.body.data.value)).toBe(50);

    // Force the recompute by adding a child <5.
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(today.getFullYear() - 2);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        name: 'Niño',
        document: 'NIÑO-1',
        birth_date: twoYearsAgo.toISOString().slice(0, 10),
        gender: 'M',
        relationship: 'HIJO_A',
        special_conditions: ['CHILD_UNDER_5'],
      });

    const after = await pool.query<{
      priority_score: number;
      priority_score_breakdown: Record<string, unknown>;
    }>('SELECT priority_score, priority_score_breakdown FROM families WHERE id = $1', [familyId]);

    // children_u5 contribution should reflect the new weight (50 * 1 = 50).
    expect(
      Number(
        (after.rows[0].priority_score_breakdown as Record<string, number>).children_u5,
      ),
    ).toBe(50);

    // breakdown.weights snapshots the value used for this compute.
    const weights = (after.rows[0].priority_score_breakdown as { weights: Record<string, number> })
      .weights;
    expect(Number(weights.W_CHILDREN_5)).toBe(50);
  });

  it('returns 404 when key is valid in the enum but missing in the table', async () => {
    // sp_scoring_config_set raises SH404 if the key row is absent. We delete
    // the row temporarily to exercise that path.
    await pool.query(`DELETE FROM scoring_config WHERE key = 'W_PREGNANT'`);
    try {
      const res = await request(app)
        .put('/api/v1/scoring-config')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ key: 'W_PREGNANT', value: 9 });
      expect(res.status).toBe(404);
    } finally {
      await pool.query(
        `INSERT INTO scoring_config (key, value) VALUES ('W_PREGNANT', 5)`,
      );
      invalidateCache();
    }
  });
});
