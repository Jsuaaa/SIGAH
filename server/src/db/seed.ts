/* eslint-disable no-console */
// Seed runner.
//
// Phase 1: create the admin user via fn_users_create. The bcrypt hash is
//          computed in Node, never in the database.
// Phase 2: execute every db/seeds/*.sql in lexicographic order.

import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { ADMIN_EMAIL } from '../config/env';

const SEEDS_DIR = path.resolve(__dirname, '../../db/seeds');

async function seedAdminUser(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query<{ email: string }>(
      'SELECT email FROM fn_users_create($1, $2, $3::role)',
      [ADMIN_EMAIL, passwordHash, 'ADMIN'],
    );
    console.log(`  ✓ admin user created: ${rows[0]?.email ?? ADMIN_EMAIL}`);
  } catch (err) {
    // SH409 = email already exists. Idempotent: skip.
    if ((err as { code?: string }).code === 'SH409') {
      console.log(`  · admin user already exists: ${ADMIN_EMAIL}`);
    } else {
      throw err;
    }
  }
}

async function applySeedFiles(): Promise<void> {
  if (!fs.existsSync(SEEDS_DIR)) {
    console.log('No db/seeds directory; skipping.');
    return;
  }

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, filename), 'utf8');
    try {
      await pool.query(sql);
      console.log(`  ✓ seed applied: ${filename}`);
    } catch (err) {
      console.error(`  ✗ seed FAILED: ${filename}`);
      throw err;
    }
  }
}

async function main(): Promise<void> {
  try {
    console.log('Seeding admin user…');
    await seedAdminUser();
    console.log('Applying SQL seeds…');
    await applySeedFiles();
    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
