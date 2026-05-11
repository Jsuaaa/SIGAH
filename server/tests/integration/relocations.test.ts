/**
 * Integration tests for /api/v1/relocations (Issue #27, HU-24, RF-15).
 *
 * Cubre:
 *  - Aplicar traslado OK (HU-24 CA1 — transacción atómica)
 *  - Rechazar cuando destino sin capacidad → 409 (HU-24 CA3)
 *  - Rechazar cuando familia no existe → 404
 *  - Rechazar cuando familia ya está en destino → 422
 *  - Listar con filtros (HU-24 CA4)
 *  - RBAC: solo ADMIN/COORDINADOR_LOGISTICA pueden crear
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
let operatorToken: string;   // OPERADOR_ENTREGAS — no puede crear

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
  operatorToken = sign('OPERADOR_ENTREGAS');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SetupIds {
  zoneId: number;
  originShelterId: number;
  destinationShelterId: number;
  familyId: number;
}

/**
 * Crea zona, refugio origen (con capacidad, 1 miembro ocupado), refugio destino
 * y familia asignada al origen.
 */
async function setupBase(
  destinationMaxCapacity = 10,
  destinationCurrentOccupancy = 0,
): Promise<SetupIds> {
  // Zona
  const zRes = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Reloc Test',
      risk_level: 'MEDIUM',
      latitude: 8.0,
      longitude: -75.0,
      estimated_population: 500,
    });
  const zoneId: number = zRes.body.data.id;

  // Refugio origen
  const oRes = await request(app)
    .post('/api/v1/shelters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Shelter Origin',
      address: 'Calle 1',
      zone_id: zoneId,
      max_capacity: 50,
      current_occupancy: 3, // 3 miembros previos (no de esta familia)
      type: 'SCHOOL',
      latitude: 8.0,
      longitude: -75.0,
    });
  const originShelterId: number = oRes.body.data.id;

  // Refugio destino
  const dRes = await request(app)
    .post('/api/v1/shelters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Shelter Destination',
      address: 'Calle 2',
      zone_id: zoneId,
      max_capacity: destinationMaxCapacity,
      current_occupancy: destinationCurrentOccupancy,
      type: 'CHURCH',
      latitude: 8.1,
      longitude: -75.1,
    });
  const destinationShelterId: number = dRes.body.data.id;

  // Familia (2 miembros) asignada al refugio origen
  const fRes = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: `DOC-RELOC-${Date.now()}`,
      zone_id: zoneId,
      shelter_id: originShelterId,
      num_members: 2,
      num_children_under_5: 0,
      num_adults_over_65: 0,
      num_pregnant: 0,
      num_disabled: 0,
      privacy_consent_accepted: true,
    });
  const familyId: number = fRes.body.data.id;

  return { zoneId, originShelterId, destinationShelterId, familyId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/relocations', () => {
  it('aplica traslado OK y retorna 201 (HU-24 CA1 — transacción atómica)', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'Razón válida para el traslado',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.family_id).toBe(familyId);
    expect(res.body.data.destination_shelter_id).toBe(destinationShelterId);
    expect(res.body.data.type).toBe('TEMPORARY');
    expect(res.body.data.id).toBeDefined();
  });

  it('COORDINADOR_LOGISTICA también puede crear → 201 (RBAC)', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'PERMANENT',
        reason: 'Traslado definitivo autorizado',
      });

    expect(res.status).toBe(201);
  });

  it('OPERADOR_ENTREGAS no puede crear → 403 (RBAC)', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'Debe fallar por permisos',
      });

    expect(res.status).toBe(403);
  });

  it('rechaza cuando familia no existe → 404', async () => {
    const { destinationShelterId } = await setupBase(10, 0);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: 999999,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'Familia inexistente',
      });

    expect(res.status).toBe(404);
  });

  it('rechaza cuando destino excede capacidad → 409 (HU-24 CA3)', async () => {
    // Refugio destino con max_capacity=1 y 1 ocupante → no caben 2 miembros
    const { familyId, destinationShelterId } = await setupBase(1, 1);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'No debe tener capacidad',
      });

    expect(res.status).toBe(409);
  });

  it('rechaza cuando familia ya está en el destino → 422', async () => {
    // Familia ya asignada al originShelterId; re-trasladamos al mismo
    const { familyId, originShelterId } = await setupBase(10, 0);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: originShelterId, // mismo que el origen
        type: 'TEMPORARY',
        reason: 'Ya está aquí',
      });

    expect(res.status).toBe(422);
  });

  it('valida que reason sea requerida (mínimo 5 chars) → 400', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    const res = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'ab', // muy corta
      });

    expect(res.status).toBe(400);
  });

  it('sin autenticación → 401', async () => {
    const res = await request(app)
      .post('/api/v1/relocations')
      .send({
        family_id: 1,
        destination_shelter_id: 2,
        type: 'TEMPORARY',
        reason: 'Sin token',
      });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/relocations', () => {
  it('lista traslados paginados (HU-24 CA4)', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    // Crear un traslado primero
    await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'Traslado para listar',
      });

    const res = await request(app)
      .get('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('filtra por family_id (HU-24 CA4)', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'PERMANENT',
        reason: 'Para filtrar por familia',
      });

    const res = await request(app)
      .get(`/api/v1/relocations?family_id=${familyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Todos los resultados deben ser de esta familia
    for (const row of res.body.data as Array<{ family_id: number }>) {
      expect(row.family_id).toBe(familyId);
    }
  });

  it('filtra por shelter_id (origen o destino) (HU-24 CA4)', async () => {
    const { destinationShelterId, familyId } = await setupBase(10, 0);

    await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'Para filtrar por shelter',
      });

    const res = await request(app)
      .get(`/api/v1/relocations?shelter_id=${destinationShelterId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filtra por type (HU-24 CA4)', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'PERMANENT',
        reason: 'Para filtrar por tipo',
      });

    const res = await request(app)
      .get('/api/v1/relocations?type=PERMANENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data as Array<{ type: string }>) {
      expect(row.type).toBe('PERMANENT');
    }
  });

  it('sin autenticación → 401', async () => {
    const res = await request(app).get('/api/v1/relocations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/relocations/:id', () => {
  it('retorna relocation enriquecida con family y shelters', async () => {
    const { familyId, destinationShelterId } = await setupBase(10, 0);

    const createRes = await request(app)
      .post('/api/v1/relocations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        family_id: familyId,
        destination_shelter_id: destinationShelterId,
        type: 'TEMPORARY',
        reason: 'Traslado para obtener por id',
      });

    const id: number = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/relocations/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.family).toBeDefined();
    expect(res.body.data.destination_shelter).toBeDefined();
  });

  it('retorna 404 si el id no existe', async () => {
    const res = await request(app)
      .get('/api/v1/relocations/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
