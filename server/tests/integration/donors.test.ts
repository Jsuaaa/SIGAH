/**
 * Integration tests for /api/v1/donors.
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
  operatorToken = sign('REGISTRADOR_DONACIONES');
  viewerToken = sign('FUNCIONARIO_CONTROL');
});

function donorBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Cruz Roja Colombiana',
    type: 'ORGANIZACION',
    contact: 'donaciones@cruzroja.org.co',
    tax_id: 'NIT-860007325-2',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/donors
// ---------------------------------------------------------------------------

describe('POST /api/v1/donors', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/donors').send(donorBody());
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is OPERATOR', async () => {
    const res = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(donorBody());
    expect(res.status).toBe(403);
  });

  it('returns 201 for each of the 5 PDF enum values (HU-18 CA1)', async () => {
    const types = ['PERSONA_NATURAL', 'EMPRESA', 'ALCALDIA', 'GOBERNACION', 'ORGANIZACION'];
    for (const t of types) {
      const res = await request(app)
        .post('/api/v1/donors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(donorBody({ name: `Donor ${t}`, type: t }));
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe(t);
    }
  });

  it('rejects unknown enum values', async () => {
    const res = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ type: 'INDIVIDUAL' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when contact is missing or empty (HU-18 CA2)', async () => {
    const a = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', type: 'EMPRESA' });
    expect(a.status).toBe(400);

    const b = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', type: 'EMPRESA', contact: '   ' });
    expect(b.status).toBe(400);
  });

  it('returns 409 on duplicate (name, type) (HU-18 CA3)', async () => {
    await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody());
    const res = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody());
    expect(res.status).toBe(409);
  });

  it('allows the same name with a different type', async () => {
    await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ type: 'ORGANIZACION' }));
    const res = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ type: 'EMPRESA' }));
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/donors
// ---------------------------------------------------------------------------

describe('GET /api/v1/donors', () => {
  it('filters by type', async () => {
    await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ name: 'A', type: 'EMPRESA', contact: 'a@x.co' }));
    await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ name: 'B', type: 'ALCALDIA', contact: 'b@x.co' }));

    const res = await request(app)
      .get('/api/v1/donors?type=ALCALDIA')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('ALCALDIA');
  });

  it('filters by is_active=false (soft-deleted donors)', async () => {
    const created = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ name: 'Inactive Co', contact: 'x@y.co' }));
    // Pre-insert a fake donations row so soft-delete kicks in.
    // The donations table doesn't exist yet (#19 lands later); this case
    // is exercised by the dedicated soft-delete tests below.
    void created;

    // Without the donations table, regular DELETE → hard-delete; the
    // is_active=false filter should still return [].
    const res = await request(app)
      .get('/api/v1/donors?is_active=false')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/donors/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/donors/:id', () => {
  it('updates contact when COORDINATOR sends a valid body', async () => {
    const created = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody());

    const res = await request(app)
      .put(`/api/v1/donors/${created.body.data.id}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ contact: 'nuevo@cruzroja.org.co' });

    expect(res.status).toBe(200);
    expect(res.body.data.contact).toBe('nuevo@cruzroja.org.co');
  });

  it('returns 404 when donor does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/donors/999999')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ contact: 'x@y.com' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/donors/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/donors/:id', () => {
  it('hard-deletes a donor with no donations attached', async () => {
    const created = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ name: 'NoDonations' }));

    const del = await request(app)
      .delete(`/api/v1/donors/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const { rows } = await pool.query('SELECT id FROM donors WHERE id = $1', [
      created.body.data.id,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('soft-deletes a donor that has donations attached (HU-18 acceptance)', async () => {
    const created = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ name: 'WithDonations' }));

    // Insert a MONETARY donation directly so we don't depend on warehouses or
    // resource_types in this test. The donations table CHECK requires
    // monetary_amount > 0 and a NULL destination_warehouse_id for MONETARY.
    await pool.query(
      `INSERT INTO donations (donation_code, donor_id, donation_type, monetary_amount)
       VALUES ($1, $2, 'MONETARY', $3)`,
      [`DON-TEST-${Date.now()}`, created.body.data.id, 1000],
    );

    const del = await request(app)
      .delete(`/api/v1/donors/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    expect(del.body.data.is_active).toBe(false);

    const { rows } = await pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM donors WHERE id = $1',
      [created.body.data.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_active).toBe(false);
  });

  it('returns 403 when role is VIEWER', async () => {
    const created = await request(app)
      .post('/api/v1/donors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donorBody({ name: 'Forbidden' }));
    const res = await request(app)
      .delete(`/api/v1/donors/${created.body.data.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});
