/**
 * Integration tests for /api/v1/warehouses and /zones/:id/warehouses.
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
  name: 'Zone Warehouses',
  risk_level: 'HIGH',
  latitude: 8.74,
  longitude: -75.9,
  estimated_population: 5000,
};

async function createZone(name = validZone.name): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...validZone, name });
  return res.body.data.id as number;
}

function warehouseBody(zone_id: number, overrides: Record<string, unknown> = {}) {
  return {
    name: 'Bodega Test Alpha',
    address: 'Av. Circunvalar 100',
    zone_id,
    max_capacity_kg: 1000,
    current_weight_kg: 500,
    status: 'ACTIVE',
    latitude: 8.74,
    longitude: -75.9,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/warehouses
// ---------------------------------------------------------------------------

describe('POST /api/v1/warehouses', () => {
  it('returns 401 without token', async () => {
    const zoneId = await createZone();
    const res = await request(app).post('/api/v1/warehouses').send(warehouseBody(zoneId));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is OPERATOR', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(warehouseBody(zoneId));
    expect(res.status).toBe(403);
  });

  it('returns 201 when ADMIN sends a valid body', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId));

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Bodega Test Alpha');
    expect(res.body.data.zone_id).toBe(zoneId);
  });

  it('returns 400 when latitude/longitude is missing (RN-10)', async () => {
    const zoneId = await createZone();
    const body = warehouseBody(zoneId);
    delete (body as { latitude?: number }).latitude;
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 422 when current_weight_kg > max_capacity_kg (RN-03)', async () => {
    const zoneId = await createZone();
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { max_capacity_kg: 500, current_weight_kg: 600 }));
    expect(res.status).toBe(422);
  });

  it('returns 404 when zone does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(999999));
    expect(res.status).toBe(404);
  });

  it('returns 409 on duplicate name', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId));
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/warehouses
// ---------------------------------------------------------------------------

describe('GET /api/v1/warehouses', () => {
  it('returns is_over_85_percent=true when current/max > 0.85', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { name: 'B-Hot', max_capacity_kg: 1000, current_weight_kg: 900 }));

    const res = await request(app)
      .get('/api/v1/warehouses')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].is_over_85_percent).toBe(true);
  });

  it('returns is_over_85_percent=false when current/max <= 0.85', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { max_capacity_kg: 1000, current_weight_kg: 500 }));

    const res = await request(app)
      .get('/api/v1/warehouses')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.body.data[0].is_over_85_percent).toBe(false);
  });

  it('filters by zone_id and status', async () => {
    const zA = await createZone('Zone WA');
    const zB = await createZone('Zone WB');
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zA, { name: 'WA-Active' }));
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zB, { name: 'WB-Inactive', status: 'INACTIVE' }));

    const res = await request(app)
      .get(`/api/v1/warehouses?zone_id=${zA}&status=ACTIVE`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('WA-Active');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/warehouses/:id  — RN-03 enforced on update
// ---------------------------------------------------------------------------

describe('PUT /api/v1/warehouses/:id', () => {
  it('returns 422 when update would exceed max capacity (RN-03)', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { max_capacity_kg: 500, current_weight_kg: 300 }));

    const res = await request(app)
      .put(`/api/v1/warehouses/${created.body.data.id}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ current_weight_kg: 600 });
    expect(res.status).toBe(422);
  });

  it('returns 200 when COORDINATOR makes a valid update', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId));

    const res = await request(app)
      .put(`/api/v1/warehouses/${created.body.data.id}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/warehouses/nearest — Haversine
// ---------------------------------------------------------------------------

describe('GET /api/v1/warehouses/nearest', () => {
  it('returns warehouses sorted by Haversine distance', async () => {
    const zoneId = await createZone();
    // Reference point is roughly Montería center.
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { name: 'Far',   latitude: 8.0,  longitude: -75.0 }));
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { name: 'Near',  latitude: 8.74, longitude: -75.9 }));

    const res = await request(app)
      .get('/api/v1/warehouses/nearest?lat=8.74&lng=-75.9&limit=5')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toBe('Near');
    expect(res.body.data[0].distance_km).toBeLessThan(res.body.data[1].distance_km);
  });

  it('excludes INACTIVE warehouses', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { name: 'Off', status: 'INACTIVE' }));

    const res = await request(app)
      .get('/api/v1/warehouses/nearest?lat=8.74&lng=-75.9')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 400 when lat or lng is missing', async () => {
    const res = await request(app)
      .get('/api/v1/warehouses/nearest?lat=8.74')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/zones/:id/warehouses
// ---------------------------------------------------------------------------

describe('GET /api/v1/zones/:id/warehouses', () => {
  it('returns warehouses with derived occupancy fields', async () => {
    const zoneId = await createZone();
    await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId, { name: 'A', max_capacity_kg: 1000, current_weight_kg: 950 }));

    const res = await request(app)
      .get(`/api/v1/zones/${zoneId}/warehouses`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].is_over_85_percent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/warehouses/:id', () => {
  it('returns 204 when ADMIN deletes', async () => {
    const zoneId = await createZone();
    const created = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(warehouseBody(zoneId));
    const res = await request(app)
      .delete(`/api/v1/warehouses/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });
});
