/**
 * sync.service.ts
 *
 * Processes batches of offline operations submitted via POST /sync.
 * Supported offline operations: POST /families, POST /persons, POST /deliveries.
 * Each op is identified by a client_op_id (UUID) for deduplication.
 *
 * Design: instead of re-routing through HTTP (circular dependency), we
 * call the underlying service functions directly and mirror the same
 * response shape used by the corresponding controllers.
 *
 * References: Issue #32 / GH #48 — backend offline sync.
 */

import { db } from '../db/client';
import * as familiesService from './families.service';
import * as personsService from './persons.service';
import * as deliveriesService from './deliveries.service';
import { familyView } from '../views/family.view';
import { personView } from '../views/person.view';
import { deliveryView } from '../views/delivery.view';

/** A single offline operation as submitted by the client. */
export interface SyncOp {
  client_op_id: string;
  method: string;
  url: string;
  payload: Record<string, unknown>;
}

/** Result for a single op in the batch response. */
export interface SyncOpResult {
  client_op_id: string;
  status_code: number;
  response: unknown;
  from_cache: boolean;
}

interface SyncLogCacheRow {
  response: unknown;
  status_code: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise URL to a canonical path for routing decisions. */
function normalisePath(url: string): string {
  // Strip query string and trailing slash.
  return url.split('?')[0].replace(/\/$/, '');
}

/** Determine which service to call based on method + url pattern. */
async function executeOp(
  op: SyncOp,
  userId: number,
): Promise<{ status_code: number; response: unknown }> {
  const path = normalisePath(op.url);
  const method = op.method.toUpperCase();

  // POST /api/v1/families
  if (method === 'POST' && /\/api\/v1\/families$/.test(path)) {
    const family = await familiesService.create(
      op.payload as unknown as Parameters<typeof familiesService.create>[0],
      userId,
      null,
      null,
    );
    return { status_code: 201, response: { success: true, data: familyView(family) } };
  }

  // POST /api/v1/persons
  if (method === 'POST' && /\/api\/v1\/persons$/.test(path)) {
    const person = await personsService.create(
      op.payload as unknown as Parameters<typeof personsService.create>[0],
    );
    return { status_code: 201, response: { success: true, data: personView(person) } };
  }

  // POST /api/v1/deliveries  (regular delivery, not batch/exception)
  if (method === 'POST' && /\/api\/v1\/deliveries$/.test(path)) {
    const delivery = await deliveriesService.create(
      {
        ...(op.payload as unknown as Parameters<typeof deliveriesService.create>[0]),
        // Ensure the client_op_id from the op is propagated to the SP for
        // database-level deduplication in the deliveries table.
        client_op_id: op.client_op_id,
      },
      userId,
      null,
      null,
    );
    return { status_code: 201, response: { success: true, data: deliveryView(delivery) } };
  }

  // Unsupported operation
  return {
    status_code: 422,
    response: {
      success: false,
      error: `Unsupported offline operation: ${method} ${path}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * processBatch: iterate ops FIFO; deduplicate via sync_log; persist each result.
 * Returns per-op results suitable for the client to reconcile its IndexedDB queue.
 */
export async function processBatch(
  ops: SyncOp[],
  userId: number,
): Promise<SyncOpResult[]> {
  const results: SyncOpResult[] = [];

  for (const op of ops) {
    // 1. Deduplication check
    const cached = await db.queryOne<SyncLogCacheRow>(
      `SELECT response, status_code FROM fn_sync_log_find($1)`,
      [op.client_op_id],
    );

    if (cached) {
      results.push({
        client_op_id: op.client_op_id,
        status_code: cached.status_code,
        response: cached.response,
        from_cache: true,
      });
      continue;
    }

    // 2. Execute
    let result: { status_code: number; response: unknown };
    try {
      result = await executeOp(op, userId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Internal error processing op';
      const statusCode =
        (err as { statusCode?: number })?.statusCode ?? 500;
      result = {
        status_code: statusCode,
        response: { success: false, error: message },
      };
    }

    // 3. Record in sync_log (ON CONFLICT DO NOTHING protects against races)
    await db.query(
      `CALL sp_sync_log_record($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
      [
        op.client_op_id,
        op.method,
        op.url,
        JSON.stringify(op.payload ?? null),
        JSON.stringify(result.response),
        result.status_code,
        userId,
      ],
    );

    results.push({
      client_op_id: op.client_op_id,
      status_code: result.status_code,
      response: result.response,
      from_cache: false,
    });
  }

  return results;
}

/**
 * getStatus: returns sync statistics for the requesting user.
 */
export async function getStatus(
  userId: number,
): Promise<{ last_processed_at: string | null; total_ops: number; ops_today: number }> {
  const row = await db.queryOne<{ fn_sync_status: unknown }>(
    `SELECT fn_sync_status($1) AS fn_sync_status`,
    [userId],
  );

  const data = (row?.fn_sync_status ?? {
    last_processed_at: null,
    total_ops: 0,
    ops_today: 0,
  }) as { last_processed_at: string | null; total_ops: number; ops_today: number };

  return {
    last_processed_at: data.last_processed_at ?? null,
    total_ops: Number(data.total_ops ?? 0),
    ops_today: Number(data.ops_today ?? 0),
  };
}
