/**
 * Integration tests for /api/v1/persons and the related
 * /api/v1/families/:id/persons endpoint.
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
      name: 'Zone Persons',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  return res.body.data.id as number;
}

async function createFamily(zoneId: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: '1066999111',
      zone_id: zoneId,
      num_members: 1,
      privacy_consent_accepted: true,
    });
  return res.body.data.id as number;
}

function isoDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function personBody(family_id: number, overrides: Record<string, unknown> = {}) {
  return {
    family_id,
    name: 'Juan Pérez',
    document: 'CC-1000000000',
    birth_date: isoDateYearsAgo(30),
    gender: 'M',
    relationship: 'PADRE_MADRE',
    special_conditions: [],
    requires_medication: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/persons — base + aggregate updates
// ---------------------------------------------------------------------------

describe('POST /api/v1/persons', () => {
  it('returns 401 when no token is provided', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    const res = await request(app).post('/api/v1/persons').send(personBody(familyId));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is VIEWER', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(personBody(familyId));
    expect(res.status).toBe(403);
  });

  it('returns 201 with the created person when OPERATOR sends a valid body', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(personBody(familyId));

    expect(res.status).toBe(201);
    expect(res.body.data.document).toBe('CC-1000000000');
    expect(res.body.data.relationship).toBe('PADRE_MADRE');
  });

  it('updates families.num_members after creating a person (aggregate)', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'A1' }));
    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'A2', name: 'Hijo' }));

    const { rows } = await pool.query<{ num_members: number }>(
      'SELECT num_members FROM families WHERE id = $1',
      [familyId],
    );
    expect(rows[0].num_members).toBe(2);
  });

  it('counts CHILD under 5 in num_children_under_5', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'BABY1', birth_date: isoDateYearsAgo(2), relationship: 'HIJO_A' }));

    const { rows } = await pool.query<{ num_children_under_5: number }>(
      'SELECT num_children_under_5 FROM families WHERE id = $1',
      [familyId],
    );
    expect(rows[0].num_children_under_5).toBe(1);
  });

  it('counts elder over 65 in num_adults_over_65', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'OLD1', birth_date: isoDateYearsAgo(70) }));

    const { rows } = await pool.query<{ num_adults_over_65: number }>(
      'SELECT num_adults_over_65 FROM families WHERE id = $1',
      [familyId],
    );
    expect(rows[0].num_adults_over_65).toBe(1);
  });

  it('counts PREGNANT and DISABLED via special_conditions', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, {
        document: 'P1',
        gender: 'F',
        relationship: 'ESPOSO_A',
        special_conditions: ['PREGNANT', 'DISABLED'],
      }));

    const { rows } = await pool.query<{ num_pregnant: number; num_disabled: number }>(
      'SELECT num_pregnant, num_disabled FROM families WHERE id = $1',
      [familyId],
    );
    expect(rows[0].num_pregnant).toBe(1);
    expect(rows[0].num_disabled).toBe(1);
  });

  it('returns 400 when birth_date is in the future', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { birth_date: future.toISOString().slice(0, 10) }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when special_conditions has an invalid value', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { special_conditions: ['UNICORN'] }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when relationship is invalid', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { relationship: 'COUSIN' }));

    expect(res.status).toBe(400);
  });

  it('returns 404 when family_id does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(999999));
    expect(res.status).toBe(404);
  });

  it('returns 409 when document is already registered', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);

    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'DUP-1' }));
    const res = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'DUP-1', name: 'Otro' }));

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/persons/:id — aggregate updates on edit
// ---------------------------------------------------------------------------

describe('PUT /api/v1/persons/:id', () => {
  it('recomputes aggregates when special_conditions changes', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    const created = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { gender: 'F', special_conditions: [] }));

    const res = await request(app)
      .put(`/api/v1/persons/${created.body.data.id}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ special_conditions: ['PREGNANT'] });

    expect(res.status).toBe(200);

    const { rows } = await pool.query<{ num_pregnant: number }>(
      'SELECT num_pregnant FROM families WHERE id = $1',
      [familyId],
    );
    expect(rows[0].num_pregnant).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/persons/:id — last-member guard + aggregate updates
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/persons/:id', () => {
  it('returns 409 when trying to delete the last member of a family', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    const created = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId));

    const res = await request(app)
      .delete(`/api/v1/persons/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it('deletes a non-last person and updates aggregates', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    const a = await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'X1' }));
    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'X2', name: 'Hijo', relationship: 'HIJO_A' }));

    const del = await request(app)
      .delete(`/api/v1/persons/${a.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    const { rows } = await pool.query<{ num_members: number }>(
      'SELECT num_members FROM families WHERE id = $1',
      [familyId],
    );
    expect(rows[0].num_members).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/persons/search?document=…
// ---------------------------------------------------------------------------

describe('GET /api/v1/persons/search', () => {
  it('returns the person and its family', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'CC-7777' }));

    const res = await request(app)
      .get('/api/v1/persons/search?document=CC-7777')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.person.document).toBe('CC-7777');
    expect(res.body.data.family.id).toBe(familyId);
    expect(res.body.data.family.family_code).toMatch(/^FAM-\d{4}-\d{5}$/);
  });

  it('returns 404 when document does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/persons/search?document=NOPE-404')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when document query param is too short', async () => {
    const res = await request(app)
      .get('/api/v1/persons/search?document=a')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/families/:id/persons
// ---------------------------------------------------------------------------

describe('GET /api/v1/families/:id/persons', () => {
  it('returns the persons that belong to the family', async () => {
    const zoneId = await createZone();
    const familyId = await createFamily(zoneId);
    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'M1', name: 'Madre', gender: 'F', relationship: 'PADRE_MADRE' }));
    await request(app)
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personBody(familyId, { document: 'C1', name: 'Hijo', relationship: 'HIJO_A' }));

    const res = await request(app)
      .get(`/api/v1/families/${familyId}/persons`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns 404 when family does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/families/999999/persons')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });
});
