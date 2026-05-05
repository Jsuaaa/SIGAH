/**
 * Integration tests for the priority_score recalculation hook (Issue #14,
 * RN-08). The score is recomputed automatically by every person mutation,
 * by family zone changes, and at family creation.
 *
 * The exact numeric value of the score depends on weights stored in
 * scoring_config (seeded by migration 008). Rather than assert specific
 * totals (brittle if weights are tuned), the tests assert directional
 * behavior: a heavier family has a strictly higher score; the breakdown
 * exposes the right input snapshot.
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

beforeAll(async () => {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE email = 'admin@sigah.gov.co' LIMIT 1`,
  );
  if (!rows[0]) {
    throw new Error('Run `pnpm db:seed` before integration tests.');
  }
  adminUserId = rows[0].id;
  adminToken = jwt.sign(
    { id: adminUserId, email: 'admin@sigah.gov.co', role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createZone(name: string, risk: string): Promise<number> {
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

async function createFamily(zoneId: number, head_document: string): Promise<{ id: number; priority_score: number }> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document,
      zone_id: zoneId,
      num_members: 1,
      privacy_consent_accepted: true,
    });
  return { id: res.body.data.id, priority_score: res.body.data.priority_score };
}

function isoDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

async function getFamilyRow(
  id: number,
): Promise<{ priority_score: number; priority_score_breakdown: Record<string, unknown> }> {
  const { rows } = await pool.query<{
    priority_score: number;
    priority_score_breakdown: Record<string, unknown>;
  }>('SELECT priority_score, priority_score_breakdown FROM families WHERE id = $1', [id]);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Family creation seeds the score
// ---------------------------------------------------------------------------

describe('priority_score on family creation', () => {
  it('initializes priority_score with a non-zero value derived from zone risk', async () => {
    const zoneId = await createZone('Score Zone Critical', 'CRITICAL');
    const family = await createFamily(zoneId, 'CRT-1');

    const row = await getFamilyRow(family.id);
    expect(row.priority_score).toBeGreaterThan(0);
    expect(row.priority_score_breakdown).toMatchObject({
      inputs: expect.objectContaining({ zone_risk_factor: 4 }),
    });
  });

  it('assigns higher score to a CRITICAL zone family than to a LOW zone one with same composition', async () => {
    const lowZone = await createZone('Score Zone Low', 'LOW');
    const critZone = await createZone('Score Zone Crit2', 'CRITICAL');

    const low = await createFamily(lowZone, 'LOW-1');
    const crit = await createFamily(critZone, 'CRT-2');

    const lowRow = await getFamilyRow(low.id);
    const critRow = await getFamilyRow(crit.id);
    expect(critRow.priority_score).toBeGreaterThan(lowRow.priority_score);
  });
});

// ---------------------------------------------------------------------------
// Person mutations recompute the score (RN-08)
// ---------------------------------------------------------------------------

describe('priority_score on person mutations', () => {
  it('increases the score after adding a child under 5', async () => {
    const zoneId = await createZone('Score Zone PA', 'HIGH');
    const family = await createFamily(zoneId, 'PA-1');
    const before = await getFamilyRow(family.id);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: family.id,
        name: 'Bebé',
        document: 'BABY-1',
        birth_date: isoDateYearsAgo(2),
        gender: 'M',
        relationship: 'HIJO_A',
        special_conditions: ['CHILD_UNDER_5'],
      });

    const after = await getFamilyRow(family.id);
    expect(after.priority_score).toBeGreaterThan(before.priority_score);
    expect(after.priority_score_breakdown).toMatchObject({
      inputs: expect.objectContaining({ num_children_under_5: 1, num_members: 1 }),
    });
  });

  it('reflects PREGNANT and DISABLED conditions in the breakdown', async () => {
    const zoneId = await createZone('Score Zone PB', 'MEDIUM');
    const family = await createFamily(zoneId, 'PB-1');

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: family.id,
        name: 'Madre',
        document: 'M-1',
        birth_date: isoDateYearsAgo(28),
        gender: 'F',
        relationship: 'PADRE_MADRE',
        special_conditions: ['PREGNANT', 'DISABLED'],
      });

    const after = await getFamilyRow(family.id);
    expect(after.priority_score_breakdown).toMatchObject({
      inputs: expect.objectContaining({
        num_pregnant: 1,
        num_disabled: 1,
        num_members: 1,
      }),
    });
    expect(Number((after.priority_score_breakdown as Record<string, number>).pregnant)).toBeGreaterThan(0);
    expect(Number((after.priority_score_breakdown as Record<string, number>).disabled)).toBeGreaterThan(0);
  });

  it('decreases or keeps the score consistent after deleting a non-last person', async () => {
    const zoneId = await createZone('Score Zone PC', 'HIGH');
    const family = await createFamily(zoneId, 'PC-1');

    const a = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: family.id,
        name: 'A',
        document: 'PC-A',
        birth_date: isoDateYearsAgo(30),
        gender: 'M',
        relationship: 'PADRE_MADRE',
      });
    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: family.id,
        name: 'B',
        document: 'PC-B',
        birth_date: isoDateYearsAgo(2),
        gender: 'F',
        relationship: 'HIJO_A',
        special_conditions: ['CHILD_UNDER_5'],
      });

    const before = await getFamilyRow(family.id);

    // Delete the child — score should drop because the children weight is gone.
    const childRes = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: family.id,
        name: 'C',
        document: 'PC-C',
        birth_date: isoDateYearsAgo(35),
        gender: 'M',
        relationship: 'HERMANO_A',
      });
    expect(childRes.status).toBe(201);

    // Now delete the actual child (B). 'a' was the parent so we keep them as
    // the surviving member after the deletion of B.
    void a;
    const personBId = (await pool.query<{ id: number }>(
      "SELECT id FROM persons WHERE document = 'PC-B'",
    )).rows[0].id;

    await request(app)
      .delete(`/api/v1/persons/${personBId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const after = await getFamilyRow(family.id);
    expect(after.priority_score).toBeLessThan(before.priority_score);
    expect(after.priority_score_breakdown).toMatchObject({
      inputs: expect.objectContaining({ num_children_under_5: 0 }),
    });
  });
});

// ---------------------------------------------------------------------------
// Zone change recomputes the score (sp_families_update hook)
// ---------------------------------------------------------------------------

describe('priority_score on zone change', () => {
  it('recomputes when a family is moved from a LOW zone to a CRITICAL one', async () => {
    const lowZone = await createZone('Score Zone ZA-Low', 'LOW');
    const critZone = await createZone('Score Zone ZB-Crit', 'CRITICAL');

    const family = await createFamily(lowZone, 'Z-1');
    const before = await getFamilyRow(family.id);

    await request(app)
      .put(`/api/v1/families/${family.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zone_id: critZone });

    const after = await getFamilyRow(family.id);
    expect(after.priority_score).toBeGreaterThan(before.priority_score);
    expect(after.priority_score_breakdown).toMatchObject({
      inputs: expect.objectContaining({ zone_risk_factor: 4 }),
    });
  });

  it('does NOT recompute when a non-zone field changes', async () => {
    const zoneId = await createZone('Score Zone Stable', 'HIGH');
    const family = await createFamily(zoneId, 'STAB-1');
    const before = await getFamilyRow(family.id);

    await request(app)
      .put(`/api/v1/families/${family.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EN_REFUGIO' });

    const after = await getFamilyRow(family.id);
    expect(after.priority_score).toBe(before.priority_score);
  });
});
