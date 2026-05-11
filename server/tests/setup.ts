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
  // audit_logs primero: no tiene FKs críticas salvo la de user_id (ON DELETE SET NULL).
  // Se trunca al inicio para que los tests de auditoría partan de tabla vacía.
  await pool.query('TRUNCATE audit_logs RESTART IDENTITY CASCADE');
  // sync_log: idempotency cache. No FKs pointing to it; truncate freely.
  await pool.query('TRUNCATE sync_log RESTART IDENTITY CASCADE');
  // CASCADE handles the dependents (persons, privacy_consents, future
  // deliveries, inventory…). resource_types is RESTRICT-referenced by
  // inventory, but inventory is wiped via warehouses CASCADE — we still
  // truncate resource_types separately so each test starts with an empty
  // catalog (the seed is reapplied on the next `pnpm db:seed`).
  // distribution_plan_items → distribution_plans first (items hold FK to deliveries).
  await pool.query('TRUNCATE distribution_plan_items RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE distribution_plans RESTART IDENTITY CASCADE');
  // deliveries / delivery_details first; CASCADE handles their dependents.
  await pool.query('TRUNCATE delivery_details RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE deliveries RESTART IDENTITY CASCADE');
  // relocations — depende de families y shelters; truncar antes que ellos.
  await pool.query('TRUNCATE relocations RESTART IDENTITY CASCADE');
  // health_vectors — FKs a zones, shelters, users (reported_by).
  await pool.query('TRUNCATE health_vectors RESTART IDENTITY CASCADE');
  // donations / donation_details next so the FK to donors/warehouses unblocks.
  await pool.query('TRUNCATE donation_details RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE donations RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE inventory_adjustments RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE inventory RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE alert_thresholds RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE resource_types RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE warehouses RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE donors RESTART IDENTITY CASCADE');
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
