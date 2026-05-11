/**
 * idempotency.middleware.ts
 *
 * Intercepts the `Idempotency-Key` header on mutating endpoints
 * (POST /deliveries, POST /families).
 *
 * Flow:
 *  1. If the header is absent → pass through (no effect).
 *  2. Look up `client_op_id` in sync_log via fn_sync_log_find.
 *     • Hit  → respond immediately with the cached status_code + response body.
 *     • Miss → monkey-patch res.json to capture the response, record it in
 *              sync_log via sp_sync_log_record, then forward the original response.
 *
 * References: Issue #32 / GH #48 — offline PWA sync, AC: Idempotency-Key previene duplicados.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/client';

interface SyncLogRow {
  response: unknown;
  status_code: number;
}

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.header('Idempotency-Key');
  if (!key) {
    next();
    return;
  }

  // 1. Check cache
  const cached = await db.queryOne<SyncLogRow>(
    `SELECT response, status_code FROM fn_sync_log_find($1)`,
    [key],
  );

  if (cached) {
    res.status(cached.status_code).json(cached.response);
    return;
  }

  // 2. Monkey-patch res.json to capture + record the response
  const originalJson = res.json.bind(res) as (body: unknown) => Response;

  // We replace res.json with a wrapper that records then delegates.
  // Using type assertion because TypeScript's overloaded signature makes the
  // replace tricky — the runtime shape is identical.
  (res as Response & { json: (body: unknown) => Response }).json = (body: unknown): Response => {
    // Fire-and-forget: record asynchronously so we do not delay the response.
    db
      .query(
        `CALL sp_sync_log_record($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
        [
          key,
          req.method,
          req.originalUrl,
          JSON.stringify(req.body ?? null),
          JSON.stringify(body),
          res.statusCode,
          (req.user as { id?: number } | undefined)?.id ?? null,
        ],
      )
      .catch((err: unknown) => {
        console.error('[idempotency] sp_sync_log_record failed:', err);
      });

    return originalJson(body);
  };

  next();
}
