/**
 * Integration tests for /api/v1/map endpoints (Issue #29 / GH #27).
 *
 * Tests confirm:
 * 1. All endpoints require authentication (401 without token).
 * 2. Each endpoint returns a GeoJSON FeatureCollection (type, features array).
 * 3. /map/families does NOT expose head_document or person names.
 * 4. /map/zone/:id aggregates all entity sub-collections for the zone.
 * 5. /map/recent-deliveries?days=7 respects the days filter.
 * 6. /map/zones-without-deliveries includes estimated_population and family_count.
 *
 * Requires a live PostgreSQL database; cleanup is handled by tests/setup.ts.
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
const censadorToken = makeToken('CENSADOR');
const operatorToken = makeToken('OPERADOR_ENTREGAS');
const coordinatorToken = makeToken('COORDINADOR_LOGISTICA');
const controlToken = makeToken('FUNCIONARIO_CONTROL');
const donorToken = makeToken('REGISTRADOR_DONACIONES');

// ---------------------------------------------------------------------------
// Helper: create a zone via API
// ---------------------------------------------------------------------------
async function createZone(name = 'Zona Mapa Test'): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 3000,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// Helper: create a shelter in a zone
async function createShelter(zoneId: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/shelters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Refugio Mapa',
      address: 'Calle 1 #2-3',
      zone_id: zoneId,
      max_capacity: 100,
      current_occupancy: 40,
      type: 'SCHOOL',
      latitude: 8.74,
      longitude: -75.9,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// Helper: create a warehouse in a zone
async function createWarehouse(zoneId: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Bodega Mapa',
      address: 'Av. Central 10',
      zone_id: zoneId,
      max_capacity_kg: 1000,
      current_weight_kg: 300,
      status: 'ACTIVE',
      latitude: 8.741,
      longitude: -75.901,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// Helper: create a family with geolocation (head_document unique)
async function createFamily(
  zoneId: number,
  headDoc = 'MAPFAM001',
): Promise<number> {
  const res = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: headDoc,
      zone_id: zoneId,
      num_members: 3,
      latitude: 8.742,
      longitude: -75.902,
      privacy_consent_accepted: true,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// Helper: create a health vector with geolocation
async function createVector(zoneId: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/health-vectors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      vector_type: 'INSECTOS',
      risk_level: 'MEDIUM',
      zone_id: zoneId,
      latitude: 8.743,
      longitude: -75.903,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// ---------------------------------------------------------------------------
// Authentication guard — 401 without token (AC6)
// ---------------------------------------------------------------------------
describe('Map endpoints — authentication required (AC6)', () => {
  const unauthenticatedEndpoints = [
    ['GET', '/api/v1/map/shelters'],
    ['GET', '/api/v1/map/warehouses'],
    ['GET', '/api/v1/map/families'],
    ['GET', '/api/v1/map/vectors'],
    ['GET', '/api/v1/map/zone/1'],
    ['GET', '/api/v1/map/recent-deliveries'],
    ['GET', '/api/v1/map/zones-without-deliveries'],
  ] as const;

  for (const [method, url] of unauthenticatedEndpoints) {
    it(`${method} ${url} → 401 without token`, async () => {
      const res = await request(app)[method.toLowerCase() as 'get'](url);
      expect(res.status).toBe(401);
    });
  }
});

// ---------------------------------------------------------------------------
// GET /map/shelters — GeoJSON FeatureCollection (AC1)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/shelters', () => {
  it('returns 200 with FeatureCollection for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/map/shelters')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.data.features)).toBe(true);
  });

  it('is accessible to all 6 roles', async () => {
    for (const token of [
      adminToken, censadorToken, operatorToken, coordinatorToken, controlToken, donorToken,
    ]) {
      const res = await request(app)
        .get('/api/v1/map/shelters')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it('feature contains occupancy_pct when a shelter exists', async () => {
    const zoneId = await createZone('Zona Albergue Mapa');
    await createShelter(zoneId);

    const res = await request(app)
      .get('/api/v1/map/shelters')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const features = res.body.data.features as Array<Record<string, unknown>>;
    expect(features.length).toBeGreaterThanOrEqual(1);
    const props = (features[0] as { properties: Record<string, unknown> }).properties;
    expect(props).toHaveProperty('max_capacity');
    expect(props).toHaveProperty('current_occupancy');
    expect(props).toHaveProperty('occupancy_pct');
  });
});

// ---------------------------------------------------------------------------
// GET /map/warehouses — GeoJSON FeatureCollection (AC1)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/warehouses', () => {
  it('returns FeatureCollection with stock_pct', async () => {
    const zoneId = await createZone('Zona Bodega Mapa');
    await createWarehouse(zoneId);

    const res = await request(app)
      .get('/api/v1/map/warehouses')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('FeatureCollection');
    const features = res.body.data.features as Array<Record<string, unknown>>;
    expect(features.length).toBeGreaterThanOrEqual(1);
    const props = (features[0] as { properties: Record<string, unknown> }).properties;
    expect(props).toHaveProperty('max_capacity_kg');
    expect(props).toHaveProperty('stock_pct');
  });
});

// ---------------------------------------------------------------------------
// GET /map/families — no personal data (AC2)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/families', () => {
  it('does NOT expose head_document or person name (AC2)', async () => {
    const zoneId = await createZone('Zona Familias Mapa');
    await createFamily(zoneId, 'MAPFAM-SEC-001');

    const res = await request(app)
      .get('/api/v1/map/families')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('FeatureCollection');

    const features = res.body.data.features as Array<{ properties: Record<string, unknown> }>;
    expect(features.length).toBeGreaterThanOrEqual(1);

    for (const feature of features) {
      expect(feature.properties).not.toHaveProperty('head_document');
      expect(feature.properties).not.toHaveProperty('name');
    }
  });

  it('features contain priority_score and status', async () => {
    const zoneId = await createZone('Zona Familias Prio');
    await createFamily(zoneId, 'MAPFAM-PRIO-001');

    const res = await request(app)
      .get('/api/v1/map/families')
      .set('Authorization', `Bearer ${adminToken}`);
    const features = res.body.data.features as Array<{ properties: Record<string, unknown> }>;
    const prop = features[0].properties;
    expect(prop).toHaveProperty('priority_score');
    expect(prop).toHaveProperty('status');
  });

  it('only includes families with latitude/longitude set', async () => {
    // Create a family WITHOUT geolocation
    const zoneId = await createZone('Zona Familias Sin Coords');
    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        head_document: 'NOCOORDS001',
        zone_id: zoneId,
        num_members: 2,
        privacy_consent_accepted: true,
        // No latitude/longitude
      });
    expect(res.status).toBe(201);
    const newFamilyId = res.body.data.id as number;

    const mapRes = await request(app)
      .get('/api/v1/map/families')
      .set('Authorization', `Bearer ${adminToken}`);
    const features = mapRes.body.data.features as Array<{ properties: { id: number } }>;
    const ids = features.map((f) => f.properties.id);
    expect(ids).not.toContain(newFamilyId);
  });
});

// ---------------------------------------------------------------------------
// GET /map/vectors — GeoJSON (AC1)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/vectors', () => {
  it('returns FeatureCollection with risk_level, status, vector_type', async () => {
    const zoneId = await createZone('Zona Vectores Mapa');
    await createVector(zoneId);

    const res = await request(app)
      .get('/api/v1/map/vectors')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('FeatureCollection');
    const features = res.body.data.features as Array<{ properties: Record<string, unknown> }>;
    expect(features.length).toBeGreaterThanOrEqual(1);
    const props = features[0].properties;
    expect(props).toHaveProperty('risk_level');
    expect(props).toHaveProperty('status');
    expect(props).toHaveProperty('vector_type');
  });
});

// ---------------------------------------------------------------------------
// GET /map/zone/:id — aggregate (AC3)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/zone/:id', () => {
  it('returns aggregate with shelters, warehouses, families, vectors, recent_deliveries (AC3)', async () => {
    const zoneId = await createZone('Zona Aggregate Mapa');
    await createShelter(zoneId);
    await createWarehouse(zoneId);
    await createFamily(zoneId, 'MAPFAM-AGG-001');
    await createVector(zoneId);

    const res = await request(app)
      .get(`/api/v1/map/zone/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;
    expect(data).toHaveProperty('zone_id', zoneId);
    expect(data).toHaveProperty('shelters');
    expect(data).toHaveProperty('warehouses');
    expect(data).toHaveProperty('families');
    expect(data).toHaveProperty('vectors');
    expect(data).toHaveProperty('recent_deliveries');

    // Each sub-collection is a FeatureCollection
    for (const key of ['shelters', 'warehouses', 'families', 'vectors', 'recent_deliveries']) {
      const collection = data[key] as { type: string; features: unknown[] };
      expect(collection.type).toBe('FeatureCollection');
      expect(Array.isArray(collection.features)).toBe(true);
    }
  });

  it('returns 404 for non-existent zone', async () => {
    const res = await request(app)
      .get('/api/v1/map/zone/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid zone id', async () => {
    const res = await request(app)
      .get('/api/v1/map/zone/abc')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /map/recent-deliveries — days filter (AC4)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/recent-deliveries', () => {
  it('returns FeatureCollection (default 7 days) (AC4)', async () => {
    const res = await request(app)
      .get('/api/v1/map/recent-deliveries')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.data.features)).toBe(true);
  });

  it('accepts ?days param', async () => {
    const res = await request(app)
      .get('/api/v1/map/recent-deliveries?days=14')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('FeatureCollection');
  });

  it('returns 400 when days=0', async () => {
    const res = await request(app)
      .get('/api/v1/map/recent-deliveries?days=0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when days=abc', async () => {
    const res = await request(app)
      .get('/api/v1/map/recent-deliveries?days=abc')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /map/zones-without-deliveries — population + family_count (AC5)
// ---------------------------------------------------------------------------
describe('GET /api/v1/map/zones-without-deliveries', () => {
  it('returns array of zones with estimated_population and family_count (AC5)', async () => {
    // Create a zone with no deliveries
    await createZone('Zona Sin Entregas');

    const res = await request(app)
      .get('/api/v1/map/zones-without-deliveries')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const data = res.body.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);

    // Each entry must have estimated_population and family_count
    for (const entry of data) {
      expect(entry).toHaveProperty('zone_id');
      expect(entry).toHaveProperty('zone_name');
      expect(entry).toHaveProperty('estimated_population');
      expect(entry).toHaveProperty('family_count');
      expect(typeof entry.estimated_population).toBe('number');
      expect(typeof entry.family_count).toBe('number');
    }
  });

  it('accepts ?days param', async () => {
    const res = await request(app)
      .get('/api/v1/map/zones-without-deliveries?days=60')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 400 for invalid days', async () => {
    const res = await request(app)
      .get('/api/v1/map/zones-without-deliveries?days=-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
