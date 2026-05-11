/**
 * Integration tests for /api/v1/families.
 *
 * Hits the Express app via supertest. Requires a live PostgreSQL database;
 * cleanup between tests is handled by the afterEach hook in ../setup.ts.
 *
 * Note on user_id: sp_families_create_with_consent validates that the JWT
 * subject matches an existing row in `users`. We resolve the seeded admin
 * user's id once and mint tokens with that id so the FK check succeeds.
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
    throw new Error(
      'Seeded admin user not found. Run `pnpm db:seed` before integration tests.',
    );
  }
  adminUserId = rows[0].id;

  const sign = (role: string) =>
    jwt.sign({ id: adminUserId, email: 'admin@sigah.gov.co', role }, JWT_SECRET, {
      expiresIn: '1h',
    });

  adminToken = sign('ADMIN');
  // Roles actualizados a los 6 valores finales del PDF (migración #9.1)
  coordinatorToken = sign('COORDINADOR_LOGISTICA');
  operatorToken = sign('CENSADOR');
  viewerToken = sign('FUNCIONARIO_CONTROL');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createZone(name = 'Test Zone Families'): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 5000,
    });
  return res.body.data.id as number;
}

function familyBody(zone_id: number, overrides: Record<string, unknown> = {}) {
  return {
    head_document: '1066999111',
    zone_id,
    num_members: 4,
    num_children_under_5: 1,
    num_pregnant: 1,
    privacy_consent_accepted: true,
    reference_address: 'Cl. 41 #14-22, Cantaclaro',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/families — RN-09 + RN-07
// ---------------------------------------------------------------------------

describe('POST /api/v1/families', () => {
  it('returns 401 when no token is provided', async () => {
    const zoneId = await createZone();
    const res = await request(app).post('/api/v1/families').send(familyBody(zoneId));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is VIEWER', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(familyBody(zoneId));
    expect(res.status).toBe(403);
  });

  it('returns 201 with FAM-YYYY-NNNNN code when ADMIN sends a valid body', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.family_code).toMatch(/^FAM-\d{4}-\d{5}$/);
    expect(res.body.data.zone_id).toBe(zoneId);
    expect(res.body.data.status).toBe('ACTIVO');
  });

  it('generates strictly increasing FAM codes for sequential creates (RN-07)', async () => {
    const zoneId = await createZone();
    const a = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { head_document: '1010000001' }));
    const b = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { head_document: '1010000002' }));

    expect(a.body.data.family_code).not.toBe(b.body.data.family_code);
    const tailA = Number(a.body.data.family_code.split('-')[2]);
    const tailB = Number(b.body.data.family_code.split('-')[2]);
    expect(tailB).toBe(tailA + 1);
  });

  it('returns 400 when privacy_consent_accepted is missing (RN-09)', async () => {
    const zoneId = await createZone();
    const body = familyBody(zoneId);
    delete (body as { privacy_consent_accepted?: boolean }).privacy_consent_accepted;
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when privacy_consent_accepted=false (RN-09)', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { privacy_consent_accepted: false }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when num_members <= 0', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { num_members: 0 }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when status is not in ACTIVO/EN_REFUGIO/EVACUADO', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { status: 'ACTIVE' }));

    expect(res.status).toBe(400);
  });

  it('returns 404 when zone_id does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(999999));

    expect(res.status).toBe(404);
  });

  it('persists privacy_consents row in the same transaction', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId));

    const familyId: number = res.body.data.id;
    const { rows } = await pool.query(
      'SELECT family_id, accepted_by_user_id, law_version FROM privacy_consents WHERE family_id = $1',
      [familyId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].accepted_by_user_id).toBe(adminUserId);
    expect(rows[0].law_version).toBe('Ley 1581/2012');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/families
// ---------------------------------------------------------------------------

describe('GET /api/v1/families', () => {
  it('returns the list filtered by zone_id', async () => {
    const zoneA = await createZone('Zone Filter A');
    const zoneB = await createZone('Zone Filter B');
    await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneA, { head_document: '11111' }));
    await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneB, { head_document: '22222' }));

    const res = await request(app)
      .get(`/api/v1/families?zone_id=${zoneA}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].zone_id).toBe(zoneA);
  });

  it('filters by status', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { head_document: 'A1', status: 'EN_REFUGIO' }));
    await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { head_document: 'A2', status: 'EVACUADO' }));

    const res = await request(app)
      .get('/api/v1/families?status=EVACUADO')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('EVACUADO');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/families/search
// ---------------------------------------------------------------------------

describe('GET /api/v1/families/search', () => {
  it('finds a family by family_code substring', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId));
    const code: string = created.body.data.family_code;

    const res = await request(app)
      .get(`/api/v1/families/search?q=${encodeURIComponent(code)}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].family_code).toBe(code);
  });

  it('finds a family by head_document', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId, { head_document: 'DOC-7777-XYZ' }));

    const res = await request(app)
      .get('/api/v1/families/search?q=DOC-7777')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].head_document).toBe('DOC-7777-XYZ');
  });

  it('returns 400 when q is too short', async () => {
    const res = await request(app)
      .get('/api/v1/families/search?q=a')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/families/:id/eligibility
// ---------------------------------------------------------------------------

describe('GET /api/v1/families/:id/eligibility', () => {
  it('returns eligibility info for an existing family', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId));

    const res = await request(app)
      .get(`/api/v1/families/${created.body.data.id}/eligibility`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_eligible).toBe(true);
    expect(res.body.data.family_code).toBe(created.body.data.family_code);
  });

  it('returns 404 for a missing family', async () => {
    const res = await request(app)
      .get('/api/v1/families/999999/eligibility')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/families/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/families/:id', () => {
  it('returns 200 when COORDINATOR updates status', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId));

    const res = await request(app)
      .put(`/api/v1/families/${created.body.data.id}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ status: 'EN_REFUGIO' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('EN_REFUGIO');
  });

  it('returns 403 when OPERADOR_ENTREGAS tries to update families', async () => {
    const operadorEntregasToken = sign('OPERADOR_ENTREGAS');
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(familyBody(zoneId));

    const res = await request(app)
      .put(`/api/v1/families/${created.body.data.id}`)
      .set('Authorization', `Bearer ${operadorEntregasToken}`)
      .send({ status: 'EVACUADO' });

    expect(res.status).toBe(403);
  });
});
