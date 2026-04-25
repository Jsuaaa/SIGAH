/**
 * Integration tests for /api/v1/zones
 *
 * These tests hit the Express app (no real HTTP port) via supertest.
 * They require a live PostgreSQL database. If the DB is unavailable,
 * tests will fail with a connection error — that is expected and correct
 * (do not skip to fake a green build).
 *
 * Cleanup between tests is handled by the afterEach hook in ../setup.ts.
 */
import '../setup'; // registers afterEach DB cleanup

import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load env before importing app (app imports config/env.ts which reads process.env)
dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from '../../src/app';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';

function makeToken(role: string, id = 9999): string {
  return jwt.sign({ id, email: `test-${role.toLowerCase()}@sigah.test`, role }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

const adminToken = makeToken('ADMIN');
const coordinatorToken = makeToken('COORDINATOR');
const operatorToken = makeToken('OPERATOR');
const viewerToken = makeToken('VIEWER');

// ---------------------------------------------------------------------------
// Shared valid zone body
// ---------------------------------------------------------------------------

const validZone = {
  name: 'Test Zone Alpha',
  risk_level: 'HIGH',
  latitude: 8.74,
  longitude: -75.9,
  estimated_population: 5000,
};

// ---------------------------------------------------------------------------
// POST /api/v1/zones
// ---------------------------------------------------------------------------

describe('POST /api/v1/zones', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/zones').send(validZone);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is OPERATOR', async () => {
    const res = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(validZone);
    expect(res.status).toBe(403);
  });

  it('returns 201 and the created zone when ADMIN sends a valid body', async () => {
    const res = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(validZone.name);
    expect(res.body.data.risk_level).toBe(validZone.risk_level);
    expect(res.body.data.id).toBeDefined();
  });

  it('returns 400 when risk_level is an invalid value (EXTREME)', async () => {
    const res = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validZone, risk_level: 'EXTREME' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when latitude is out of range (200)', async () => {
    const res = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validZone, latitude: 200 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when zone name already exists', async () => {
    // Create the zone once
    await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    // Try to create it again
    const res = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/zones (paginated list)
// ---------------------------------------------------------------------------

describe('GET /api/v1/zones', () => {
  /**
   * Creates n zones with deterministic names and returns them.
   * Helper to avoid repetitive setup in tests below.
   */
  async function create25Zones(): Promise<void> {
    const promises = Array.from({ length: 25 }, (_, i) =>
      request(app)
        .post('/api/v1/zones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Zone ${String(i + 1).padStart(3, '0')}`,
          risk_level: 'LOW',
          latitude: 8.0 + i * 0.01,
          longitude: -75.0 - i * 0.01,
          estimated_population: 1000 + i,
        }),
    );
    await Promise.all(promises);
  }

  it('returns page 2 with 10 items and total=25 when 25 zones exist', async () => {
    await create25Zones();

    const res = await request(app)
      .get('/api/v1/zones?page=2&limit=10')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBe(25);
    expect(res.body.pagination.totalPages).toBe(3);
  });

  it('filters by search=Zone 001 and returns matching zones', async () => {
    await create25Zones();

    const res = await request(app)
      .get('/api/v1/zones?search=Zone 001')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    // "Zone 001" matches exactly one zone
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.every((z: { name: string }) =>
        z.name.toLowerCase().includes('zone 001'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/zones/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/zones/:id', () => {
  it('returns 404 when the zone does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/zones/999999')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with zone data for a valid id', async () => {
    const created = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    const id: number = created.body.data.id;

    const res = await request(app)
      .get(`/api/v1/zones/${id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/zones/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/zones/:id', () => {
  it('returns 200 and updated zone when COORDINATOR changes risk_level', async () => {
    const created = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    const id: number = created.body.data.id;

    const res = await request(app)
      .put(`/api/v1/zones/${id}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ risk_level: 'CRITICAL' });

    expect(res.status).toBe(200);
    expect(res.body.data.risk_level).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/zones/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/zones/:id', () => {
  it('returns 403 when VIEWER tries to delete', async () => {
    const created = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    const id: number = created.body.data.id;

    const res = await request(app)
      .delete(`/api/v1/zones/${id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 204 when ADMIN deletes an existing zone', async () => {
    const created = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);

    const id: number = created.body.data.id;

    const res = await request(app)
      .delete(`/api/v1/zones/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/zones/:id/families|shelters|warehouses (stubs)
// ---------------------------------------------------------------------------

describe('GET /api/v1/zones/:id/families|shelters|warehouses (stubs)', () => {
  let zoneId: number;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validZone);
    zoneId = res.body.data.id;
  });

  it('GET /:id/families returns 200 with empty data array', async () => {
    const res = await request(app)
      .get(`/api/v1/zones/${zoneId}/families`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /:id/shelters returns 200 with empty data array', async () => {
    const res = await request(app)
      .get(`/api/v1/zones/${zoneId}/shelters`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /:id/warehouses returns 200 with empty data array', async () => {
    const res = await request(app)
      .get(`/api/v1/zones/${zoneId}/warehouses`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /:id/shelters returns 404 when zone does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/zones/999999/shelters')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(404);
  });
});
