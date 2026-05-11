/**
 * Integration tests for /api/v1/health-vectors.
 *
 * Hits the Express app via supertest against a live PostgreSQL test database.
 * Cleanup between tests is handled by the afterEach hook in ../setup.ts.
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

const adminToken        = makeToken('ADMIN', 1001);
const coordinatorToken  = makeToken('COORDINADOR_LOGISTICA', 1002);
const funcionarioToken  = makeToken('FUNCIONARIO_CONTROL', 1003);
const censadorToken     = makeToken('CENSADOR', 1004);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validZone = {
  name: 'Zona HV Test',
  risk_level: 'HIGH',
  latitude: 8.74,
  longitude: -75.9,
  estimated_population: 3000,
};

async function createZone(name = validZone.name): Promise<number> {
  const res = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...validZone, name });
  return res.body.data.id as number;
}

function hvBody(zone_id: number, overrides: Record<string, unknown> = {}) {
  return {
    vector_type: 'INSECTOS',
    risk_level: 'HIGH',
    description: 'Presencia de mosquitos en el sector norte',
    zone_id,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/health-vectors
// ---------------------------------------------------------------------------

describe('POST /api/v1/health-vectors', () => {
  it('returns 401 without token', async () => {
    const zone_id = await createZone();
    const res = await request(app).post('/api/v1/health-vectors').send(hvBody(zone_id));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is CENSADOR', async () => {
    const zone_id = await createZone();
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${censadorToken}`)
      .send(hvBody(zone_id));
    expect(res.status).toBe(403);
  });

  it('returns 403 when role is FUNCIONARIO_CONTROL', async () => {
    const zone_id = await createZone();
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${funcionarioToken}`)
      .send(hvBody(zone_id));
    expect(res.status).toBe(403);
  });

  it('returns 201 when ADMIN sends a valid body with zone_id', async () => {
    const zone_id = await createZone();
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vector_type).toBe('INSECTOS');
    expect(res.body.data.risk_level).toBe('HIGH');
    expect(res.body.data.status).toBe('ACTIVO');
    expect(res.body.data.zone_id).toBe(zone_id);
  });

  it('returns 201 when COORDINADOR_LOGISTICA creates with coords only', async () => {
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        vector_type: 'AGUA_CONTAMINADA',
        risk_level: 'CRITICAL',
        latitude: 8.74,
        longitude: -75.9,
        description: 'Agua contaminada detectada',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.vector_type).toBe('AGUA_CONTAMINADA');
    expect(res.body.data.latitude).toBe(8.74);
  });

  it('returns 400 when vector_type is invalid', async () => {
    const zone_id = await createZone();
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id, { vector_type: 'SERPIENTES' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when risk_level is missing', async () => {
    const zone_id = await createZone();
    const body = hvBody(zone_id);
    const { risk_level: _rl, ...bodyWithout } = body;
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(bodyWithout);
    expect(res.status).toBe(400);
  });

  it('returns 422 when no location reference is provided', async () => {
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vector_type: 'ROEDORES',
        risk_level: 'MEDIUM',
        description: 'Sin referencia geográfica',
      });
    // SP raises SH422 which maps to 422
    expect(res.status).toBe(422);
  });

  it('returns 404 when zone_id does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(999999));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/health-vectors
// ---------------------------------------------------------------------------

describe('GET /api/v1/health-vectors', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/health-vectors');
    expect(res.status).toBe(401);
  });

  it('returns 200 with pagination for authenticated user', async () => {
    const zone_id = await createZone();
    // Create two vectors
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id, { vector_type: 'INSECTOS' }));
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id, { vector_type: 'ROEDORES' }));

    const res = await request(app)
      .get('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${funcionarioToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
  });

  it('filters by vector_type', async () => {
    const zone_id = await createZone();
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id, { vector_type: 'AGUA_CONTAMINADA' }));
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id, { vector_type: 'ROEDORES' }));

    const res = await request(app)
      .get('/api/v1/health-vectors?vector_type=AGUA_CONTAMINADA')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((hv: { vector_type: string }) => hv.vector_type === 'AGUA_CONTAMINADA')).toBe(true);
  });

  it('filters by zone_id', async () => {
    const zone_id = await createZone('Zone HV Alpha');
    const zone_id2 = await createZone('Zone HV Beta');
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id2, { vector_type: 'OTRO' }));

    const res = await request(app)
      .get(`/api/v1/health-vectors?zone_id=${zone_id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((hv: { zone_id: number }) => hv.zone_id === zone_id)).toBe(true);
  });

  it('filters by status', async () => {
    const zone_id = await createZone();
    const createRes = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));

    const hvId = createRes.body.data.id as number;
    // Move to EN_ATENCION
    await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EN_ATENCION' });

    const res = await request(app)
      .get('/api/v1/health-vectors?status=EN_ATENCION')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((hv: { id: number }) => hv.id === hvId)).toBe(true);
  });

  it('filters by risk_level', async () => {
    const zone_id = await createZone();
    await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id, { risk_level: 'CRITICAL' }));

    const res = await request(app)
      .get('/api/v1/health-vectors?risk_level=CRITICAL')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((hv: { risk_level: string }) => hv.risk_level === 'CRITICAL')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/health-vectors/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/health-vectors/:id', () => {
  it('returns 200 with zone/shelter snapshot', async () => {
    const zone_id = await createZone();
    const createRes = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    const hvId = createRes.body.data.id as number;

    const res = await request(app)
      .get(`/api/v1/health-vectors/${hvId}`)
      .set('Authorization', `Bearer ${funcionarioToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(hvId);
    expect(res.body.data.zone).toBeDefined();
    expect(res.body.data.zone.id).toBe(zone_id);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/api/v1/health-vectors/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/health-vectors/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/health-vectors/:id', () => {
  it('returns 200 when ADMIN updates editable fields', async () => {
    const zone_id = await createZone();
    const createRes = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    const hvId = createRes.body.data.id as number;

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ risk_level: 'CRITICAL', description: 'Actualizado' });

    expect(res.status).toBe(200);
    expect(res.body.data.risk_level).toBe('CRITICAL');
  });

  it('returns 403 when FUNCIONARIO_CONTROL tries to update', async () => {
    const zone_id = await createZone();
    const createRes = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    const hvId = createRes.body.data.id as number;

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}`)
      .set('Authorization', `Bearer ${funcionarioToken}`)
      .send({ risk_level: 'LOW' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when health vector does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/health-vectors/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'X' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/health-vectors/:id/status
// ---------------------------------------------------------------------------

describe('PUT /api/v1/health-vectors/:id/status', () => {
  async function createHv(zone_id: number) {
    const res = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    return res.body.data.id as number;
  }

  it('returns 200 transitioning ACTIVO → EN_ATENCION (HU-25 CA3)', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EN_ATENCION', actions_taken: 'Enviado equipo de fumigación' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('EN_ATENCION');
    expect(res.body.data.actions_taken).toBe('Enviado equipo de fumigación');
  });

  it('returns 200 transitioning EN_ATENCION → RESUELTO, sets resolved_at', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EN_ATENCION' });

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESUELTO', actions_taken: 'Problema resuelto' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESUELTO');
    expect(res.body.data.resolved_at).not.toBeNull();
  });

  it('returns 422 transitioning RESUELTO → ACTIVO (HU-25 CA3 — transición inválida)', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    // Resolve first
    await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESUELTO' });

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVO' });

    expect(res.status).toBe(422);
  });

  it('returns 422 transitioning RESUELTO → EN_ATENCION (HU-25 CA3 — transición inválida)', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESUELTO' });

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EN_ATENCION' });

    expect(res.status).toBe(422);
  });

  it('returns 400 when status is invalid', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INEXISTENTE' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when FUNCIONARIO_CONTROL tries to set status', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${funcionarioToken}`)
      .send({ status: 'EN_ATENCION' });

    expect(res.status).toBe(403);
  });

  it('returns 200 transitioning ACTIVO → RESUELTO directly', async () => {
    const zone_id = await createZone();
    const hvId = await createHv(zone_id);

    const res = await request(app)
      .put(`/api/v1/health-vectors/${hvId}/status`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ status: 'RESUELTO' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESUELTO');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/health-vectors/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/health-vectors/:id', () => {
  it('returns 403 when COORDINADOR_LOGISTICA tries to delete', async () => {
    const zone_id = await createZone();
    const createRes = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    const hvId = createRes.body.data.id as number;

    const res = await request(app)
      .delete(`/api/v1/health-vectors/${hvId}`)
      .set('Authorization', `Bearer ${coordinatorToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 204 when ADMIN deletes an existing vector', async () => {
    const zone_id = await createZone();
    const createRes = await request(app)
      .post('/api/v1/health-vectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(hvBody(zone_id));
    const hvId = createRes.body.data.id as number;

    const res = await request(app)
      .delete(`/api/v1/health-vectors/${hvId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify it is gone
    const getRes = await request(app)
      .get(`/api/v1/health-vectors/${hvId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when vector does not exist', async () => {
    const res = await request(app)
      .delete('/api/v1/health-vectors/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
