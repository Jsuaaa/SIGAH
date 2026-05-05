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
  // CASCADE handles the dependents (persons, privacy_consents, future
  // deliveries, inventory…). resource_types is RESTRICT-referenced by
  // inventory, but inventory is wiped via warehouses CASCADE — we still
  // truncate resource_types separately so each test starts with an empty
  // catalog (the seed is reapplied on the next `pnpm db:seed`).
  await pool.query('TRUNCATE inventory_adjustments RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE inventory RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE resource_types RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE warehouses RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE families RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE shelters RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE zones RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE code_counters');
  // scoring_config rows are required by fn_priority_score; do not truncate
  // them between tests.
  await pool.query(
    `DELETE FROM users WHERE email <> 'admin@sigah.gov.co'`,
  );
});

afterAll(async () => {
  await pool.end();
});

export { pool };
