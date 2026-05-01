import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from '../config/database';
import { mapPgError } from '../types/pg-errors';

// Thin wrappers around pg.Pool that:
//   1. Translate SIGAH custom SQLSTATEs (SH4xx) into AppError.
//   2. Provide a transaction helper for the rare case Node needs one
//      (most transactions live inside SPs and never reach this layer).

async function runQuery<T extends QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
  client?: PoolClient,
): Promise<QueryResult<T>> {
  try {
    const exec = client ?? pool;
    return (await exec.query<T>(text, params as unknown[])) as QueryResult<T>;
  } catch (err) {
    throw mapPgError(err);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> {
  return runQuery<T>(text, params);
}

// Returns the first row or null. Convenient for SETOF/UNIQUE lookups.
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<T | null> {
  const result = await runQuery<T>(text, params);
  return result.rows[0] ?? null;
}

// Run `fn` inside BEGIN/COMMIT. Rolls back on any thrown error and rethrows.
// Reserved for the rare cases where a single SP cannot express the work
// (e.g. orchestrating across services in tests).
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw mapPgError(err);
  } finally {
    client.release();
  }
}

export const db = { query, queryOne, withTransaction };
