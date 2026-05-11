/**
 * Schema-level tests for deliveries / delivery_details (Issue #22).
 *
 * #23 and #24 layer the transactional creation, eligibility, batch and
 * idempotency on top. This file only exercises the constraints and the
 * read-side SPs (fn_deliveries_list, fn_deliveries_find_by_id,
 * fn_delivery_check_eligibility, fn_deliveries_by_family) so the schema is
 * provably ready for those issues to plug in.
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
  if (!rows[0]) throw new Error('Run `pnpm db:seed` before integration tests.');
  adminUserId = rows[0].id;
  adminToken = jwt.sign(
    { id: adminUserId, email: 'admin@sigah.gov.co', role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
});

// ---------------------------------------------------------------------------
// Setup helpers — build a minimal world (zone + warehouse + family) needed
// for direct INSERTs into deliveries.
// ---------------------------------------------------------------------------

interface World {
  familyId: number;
  warehouseId: number;
}

async function setupWorld(): Promise<World> {
  const z = await request(app)
    .post('/api/v1/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Zone Deliveries',
      risk_level: 'HIGH',
      latitude: 8.74,
      longitude: -75.9,
      estimated_population: 1000,
    });
  const w = await request(app)
    .post('/api/v1/warehouses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'WH Deliveries',
      address: 'Av. 1',
      zone_id: z.body.data.id,
      max_capacity_kg: 1000,
      current_weight_kg: 0,
      status: 'ACTIVE',
      latitude: 8.74,
      longitude: -75.9,
    });
  const f = await request(app)
    .post('/api/v1/families')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      head_document: 'DEL-1',
      zone_id: z.body.data.id,
      num_members: 4,
      privacy_consent_accepted: true,
    });
  return { familyId: f.body.data.id, warehouseId: w.body.data.id };
}

async function insertDelivery(
  w: World,
  overrides: Record<string, unknown> = {},
): Promise<number> {
  const row = await pool.query<{ id: number }>(
    `INSERT INTO deliveries
       (delivery_code, family_id, source_warehouse_id, coverage_days, status,
        delivery_date, exception_reason, exception_authorized_by, client_op_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      (overrides.delivery_code as string) ?? `ENT-TEST-${Date.now()}-${Math.random()}`,
      (overrides.family_id as number) ?? w.familyId,
      (overrides.source_warehouse_id as number) ?? w.warehouseId,
      (overrides.coverage_days as number) ?? 3,
      (overrides.status as string) ?? 'PROGRAMADA',
      (overrides.delivery_date as string) ?? new Date().toISOString(),
      (overrides.exception_reason as string | null) ?? null,
      (overrides.exception_authorized_by as number | null) ?? null,
      (overrides.client_op_id as string | null) ?? null,
    ],
  );
  return row.rows[0].id;
}

// ---------------------------------------------------------------------------
// Schema constraints
// ---------------------------------------------------------------------------

describe('deliveries schema', () => {
  it('rejects coverage_days < 3 (RN-01 CHECK)', async () => {
    const w = await setupWorld();
    await expect(
      insertDelivery(w, { coverage_days: 2 }),
    ).rejects.toThrow(/coverage_days/);
  });

  it('accepts coverage_days = 3', async () => {
    const w = await setupWorld();
    const id = await insertDelivery(w, { coverage_days: 3 });
    expect(id).toBeGreaterThan(0);
  });

  it('rejects status outside PROGRAMADA/EN_CURSO/ENTREGADA', async () => {
    const w = await setupWorld();
    await expect(
      pool.query(
        `INSERT INTO deliveries (delivery_code, family_id, source_warehouse_id, coverage_days, status)
         VALUES ($1, $2, $3, 3, 'SCHEDULED')`,
        [`ENT-X-${Date.now()}`, w.familyId, w.warehouseId],
      ),
    ).rejects.toThrow();
  });

  it('enforces UNIQUE on client_op_id (idempotency for #48)', async () => {
    const w = await setupWorld();
    const code = `ENT-OP-${Date.now()}`;
    await insertDelivery(w, { delivery_code: `${code}-1`, client_op_id: 'OP-DUP' });
    await expect(
      insertDelivery(w, { delivery_code: `${code}-2`, client_op_id: 'OP-DUP' }),
    ).rejects.toThrow();
  });

  it('rejects exception_reason set without exception_authorized_by', async () => {
    const w = await setupWorld();
    await expect(
      insertDelivery(w, { exception_reason: 'urgent' }),
    ).rejects.toThrow();
  });

  it('accepts an exception with both reason and authorized_by', async () => {
    const w = await setupWorld();
    const id = await insertDelivery(w, {
      exception_reason: 'urgent',
      exception_authorized_by: adminUserId,
    });
    expect(id).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Read-side SPs
// ---------------------------------------------------------------------------

describe('fn_deliveries_list / fn_deliveries_find_by_id', () => {
  it('returns enriched deliveries with family and warehouse joined', async () => {
    const w = await setupWorld();
    const id = await insertDelivery(w);

    const list = await pool.query<{ data: { id: number }[]; total: string }>(
      'SELECT * FROM fn_deliveries_list(NULL, NULL, NULL::delivery_status, NULL, NULL, $1, $2)',
      [10, 0],
    );
    expect(Number(list.rows[0].total)).toBe(1);
    expect(list.rows[0].data[0].id).toBe(id);

    const findRes = await pool.query<{ data: Record<string, unknown> }>(
      'SELECT data FROM fn_deliveries_find_by_id($1)',
      [id],
    );
    const row = findRes.rows[0].data as {
      family: { id: number };
      warehouse: { id: number };
      details: unknown[];
    };
    expect(row.family.id).toBe(w.familyId);
    expect(row.warehouse.id).toBe(w.warehouseId);
    expect(row.details).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fn_delivery_check_eligibility (RN-02)
// ---------------------------------------------------------------------------

describe('fn_delivery_check_eligibility', () => {
  it('returns is_eligible=true when no deliveries exist', async () => {
    const w = await setupWorld();
    const res = await pool.query<{
      is_eligible: boolean;
      reason: string;
    }>('SELECT * FROM fn_delivery_check_eligibility($1)', [w.familyId]);
    expect(res.rows[0].is_eligible).toBe(true);
    expect(res.rows[0].reason).toBe('ELIGIBLE');
  });

  it('returns is_eligible=false when an ENTREGADA delivery has open coverage (RN-02)', async () => {
    const w = await setupWorld();
    await insertDelivery(w, {
      status: 'ENTREGADA',
      coverage_days: 3,
      delivery_date: new Date().toISOString(),
    });

    const res = await pool.query<{
      is_eligible: boolean;
      reason: string;
      days_remaining: number;
    }>('SELECT * FROM fn_delivery_check_eligibility($1)', [w.familyId]);
    expect(res.rows[0].is_eligible).toBe(false);
    expect(res.rows[0].reason).toBe('COVERED');
    expect(res.rows[0].days_remaining).toBeGreaterThanOrEqual(0);
  });

  it('returns is_eligible=true when coverage has expired', async () => {
    const w = await setupWorld();
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await insertDelivery(w, {
      status: 'ENTREGADA',
      coverage_days: 3,
      delivery_date: tenDaysAgo.toISOString(),
    });

    const res = await pool.query<{ is_eligible: boolean; reason: string }>(
      'SELECT * FROM fn_delivery_check_eligibility($1)',
      [w.familyId],
    );
    expect(res.rows[0].is_eligible).toBe(true);
    expect(res.rows[0].reason).toBe('ELIGIBLE');
  });

  it('raises SH404 when family does not exist', async () => {
    await expect(
      pool.query('SELECT * FROM fn_delivery_check_eligibility($1)', [999999]),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// /families/:id/eligibility now delegates to the real SP
// ---------------------------------------------------------------------------

describe('GET /api/v1/families/:id/eligibility — delegated to deliveries', () => {
  it('returns ELIGIBLE for a brand-new family', async () => {
    const w = await setupWorld();
    const res = await request(app)
      .get(`/api/v1/families/${w.familyId}/eligibility`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_eligible).toBe(true);
    expect(res.body.data.reason).toBe('ELIGIBLE');
  });

  it('returns COVERED after an ENTREGADA delivery within the coverage window', async () => {
    const w = await setupWorld();
    await insertDelivery(w, { status: 'ENTREGADA', coverage_days: 5 });

    const res = await request(app)
      .get(`/api/v1/families/${w.familyId}/eligibility`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.is_eligible).toBe(false);
    expect(res.body.data.reason).toBe('COVERED');
    expect(res.body.data.next_eligible_at).toBeDefined();
  });
});
