import { Pool } from 'pg';
import { DATABASE_URL } from './env';

// Single process-wide pg pool. Replaces the Prisma client singleton.
// All data access goes through `src/db/client.ts`, which calls into this pool.
export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Modest defaults; tune if/when load tests demand it.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Idle client errors must not crash the process; they show up here.
  console.error('Unexpected pg pool error:', err);
});
