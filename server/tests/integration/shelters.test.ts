/**
 * Integration tests for /api/v1/shelters and the nested /zones/:id/shelters
 * endpoint.
 *
 * Hits the Express app via supertest. Requires a live PostgreSQL database;
 * cleanup between tests is handled by the afterEach hook in ../setup.ts.
 */
import '../setup';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from '../../src/app';

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

const validZone = {
  name: 'Test Zone Shelters',
  risk_level: 'HIGH',
  latitude: 8.74,
  longitude: -75.9,
  estimated_population: 5000,
};

async function createZone(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(validZone);
  return res.body.data.id as number;
}

function shelterBody(zone_id: number, overrides: Record<string, unknown> = {}) {
  return {
    name: 'Refugio Alpha',
    address: 'Calle Falsa 123',
    zone_id,
    max_capacity: 100,
    current_occupancy: 50,
    type: 'SCHOOL',
    latitude: 8.74,
    longitude: -75.9,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/shelters
// ---------------------------------------------------------------------------

describe('POST /api/v1/shelters', () => {
  it('returns 401 when no token is provided', async () => {
    const zoneId = await createZone();
    const res = await request(app).post('/api/v1/shelters').send(shelterBody(zoneId));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is OPERATOR', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(shelterBody(zoneId));
    expect(res.status).toBe(403);
  });

  it('returns 201 with the created shelter when ADMIN sends a valid body', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Refugio Alpha');
    expect(res.body.data.zone_id).toBe(zoneId);
    expect(res.body.data.id).toBeDefined();
  });

  it('returns 400 when latitude or longitude is missing (RN-10)', async () => {
    const zoneId = await createZone();
    const { latitude: _ignored, ...body } = shelterBody(zoneId);
    void _ignored;
    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when type is invalid', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { type: 'CASTLE' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when current_occupancy > max_capacity', async () => {
    // express-validator does not enforce cross-field comparisons, so the SP
    // must catch this. We send something the validator accepts and expect a
    // 422 from the DB CHECK constraint.
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { max_capacity: 50, current_occupancy: 100 }));

    expect(res.status).toBe(422);
  });

  it('returns 404 when zone_id does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(999999));

    expect(res.status).toBe(404);
  });

  it('returns 409 when (name, zone_id) already exists', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId));

    const res = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId));

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/shelters
// ---------------------------------------------------------------------------

describe('GET /api/v1/shelters', () => {
  it('returns is_over_capacity=true when current_occupancy > 90% of max', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { name: 'Refugio Lleno', max_capacity: 100, current_occupancy: 95 }));

    const res = await request(app)
      .get('/api/v1/shelters')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].is_over_capacity).toBe(true);
  });

  it('returns is_over_capacity=false when current_occupancy <= 90%', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { max_capacity: 100, current_occupancy: 50 }));

    const res = await request(app)
      .get('/api/v1/shelters')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.body.data[0].is_over_capacity).toBe(false);
  });

  it('filters by zone_id', async () => {
    const zoneA = await createZone();
    const zoneBRes = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validZone, name: 'Test Zone B' });
    const zoneB = zoneBRes.body.data.id;

    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneA, { name: 'Ref A' }));
    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneB, { name: 'Ref B' }));

    const res = await request(app)
      .get(`/api/v1/shelters?zone_id=${zoneA}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Ref A');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/shelters/:id/occupancy
// ---------------------------------------------------------------------------

describe('PUT /api/v1/shelters/:id/occupancy', () => {
  it('returns 200 and updates occupancy for OPERATOR', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { max_capacity: 100, current_occupancy: 10 }));

    const res = await request(app)
      .put(`/api/v1/shelters/${created.body.data.id}/occupancy`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ current_occupancy: 80 });

    expect(res.status).toBe(200);
    expect(res.body.data.current_occupancy).toBe(80);
  });

  it('returns 422 when occupancy exceeds max_capacity', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { max_capacity: 100, current_occupancy: 10 }));

    const res = await request(app)
      .put(`/api/v1/shelters/${created.body.data.id}/occupancy`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ current_occupancy: 150 });

    expect(res.status).toBe(422);
  });

  it('returns 404 when shelter does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/shelters/999999/occupancy')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ current_occupancy: 10 });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/shelters/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/shelters/:id', () => {
  it('returns 204 when ADMIN deletes', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId));

    const res = await request(app)
      .delete(`/api/v1/shelters/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 403 when VIEWER tries to delete', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId));

    const res = await request(app)
      .delete(`/api/v1/shelters/${created.body.data.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/zones/:id/shelters (real implementation now that #11 lands)
// ---------------------------------------------------------------------------

describe('GET /api/v1/zones/:id/shelters', () => {
  it('returns shelters for a zone with derived occupancy fields', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { name: 'A', max_capacity: 100, current_occupancy: 95 }));
    await request(app)
      .post('/api/v1/shelters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shelterBody(zoneId, { name: 'B', max_capacity: 100, current_occupancy: 30 }));

    const res = await request(app)
      .get(`/api/v1/zones/${zoneId}/shelters`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const overCapacity = res.body.data.find((s: { name: string }) => s.name === 'A');
    expect(overCapacity.is_over_capacity).toBe(true);
  });
});
