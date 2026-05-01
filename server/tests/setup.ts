import dotenv from 'dotenv';
import path from 'path';

// Load .env.test if it exists, otherwise fall back to .env. This must run
// before importing anything that reads process.env (e.g. config/env.ts).
dotenv.config({ path: path.join(__dirname, '../.env.test') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import { pool } from '../src/config/database';

/**
 * Truncates the tables that integration tests mutate, restarting identity
 * sequences. Keeps the seeded admin user (`admin@sigah.gov.co`) so JWT helpers
 * keep working.
 *
 * Order matters: child tables before parents (zones currently has no
 * dependents, but the helper is forward-compatible).
 */
afterEach(async () => {
  await pool.query('TRUNCATE zones RESTART IDENTITY CASCADE');
  await pool.query(
    `DELETE FROM users WHERE email <> 'admin@sigah.gov.co'`,
  );
});

afterAll(async () => {
  await pool.end();
});

export { pool };
