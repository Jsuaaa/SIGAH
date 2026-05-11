// Read/write façade over the `scoring_config` table with an in-memory cache
// so fn_priority_score callers don't pay a round-trip on every recalculation
// (it still does, since the SP itself reads the table — but the cache here
// powers the `GET /scoring-config` endpoint and any future Node-side
// formula consumers).
//
// Cache invalidation:
//   - PUT /scoring-config calls model.set, which fires `sp_scoring_config_set`
//     and triggers `pg_notify('scoring_config_changed', <key>)`. The PUT
//     handler also clears the cache locally so the response after the PUT
//     reflects the new value even before the LISTEN round-trip lands.
//   - A long-lived pg.Client subscribed to `LISTEN scoring_config_changed`
//     (started by `startScoringConfigListener` from src/index.ts) clears the
//     cache when the notification arrives, so direct DB edits also propagate.

import { Client, type Notification } from 'pg';
import { DATABASE_URL } from '../config/env';
import { ScoringConfigModel } from '../models/scoringConfig.model';
import type { ScoringConfigKey, ScoringConfigRow } from '../types/entities';

let cache: ScoringConfigRow[] | null = null;
let listenerClient: Client | null = null;

export function invalidateCache(): void {
  cache = null;
}

export async function getAll(): Promise<ScoringConfigRow[]> {
  if (cache) return cache;
  const rows = await ScoringConfigModel.list();
  cache = rows;
  return rows;
}

export async function getWeights(): Promise<Record<string, number>> {
  const rows = await getAll();
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
}

export async function set(
  key: ScoringConfigKey,
  value: number,
  user_id: number,
): Promise<ScoringConfigRow> {
  const row = await ScoringConfigModel.set(key, value, user_id);
  invalidateCache();
  return row;
}

// LISTEN client. Kept separate from the pool because pg.Pool clients are
// returned after every query — the LISTEN subscription must live on a
// long-lived connection.
export async function startScoringConfigListener(): Promise<void> {
  if (listenerClient) return;

  const client = new Client({ connectionString: DATABASE_URL });
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('scoring_config listener error:', err);
  });
  client.on('notification', (msg: Notification) => {
    if (msg.channel === 'scoring_config_changed') {
      invalidateCache();
    }
  });

  await client.connect();
  await client.query('LISTEN scoring_config_changed');
  listenerClient = client;
}

export async function stopScoringConfigListener(): Promise<void> {
  if (!listenerClient) return;
  await listenerClient.end();
  listenerClient = null;
}
