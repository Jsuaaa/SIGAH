/* eslint-disable no-console */
// Seed runner.
//
// Fase 1: crea (o actualiza) el usuario admin con name='Administrador SIGAH'
//         y password_must_change=true. El hash bcrypt se calcula en Node.
// Fase 2: aplica cada archivo db/seeds/*.sql en orden lexicográfico.

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
    // Intentar crear; si ya existe (SH409) actualizar name/password_must_change
    const { rows } = await pool.query<{ email: string }>(
      'SELECT email FROM fn_users_create($1, $2, $3::role, $4)',
      [ADMIN_EMAIL, passwordHash, 'ADMIN', 'Administrador SIGAH'],
    );
    console.log(`  ✓ admin user created: ${rows[0]?.email ?? ADMIN_EMAIL}`);
  } catch (err) {
    // SH409 = email ya existe. Actualizamos campos que añade la migración #9.1.
    if ((err as { code?: string }).code === 'SH409') {
      await pool.query(
        `UPDATE users
            SET name                 = $1,
                password_hash        = $2,
                password_must_change = true,
                is_active            = true,
                updated_at           = now()
          WHERE email = $3`,
        ['Administrador SIGAH', passwordHash, ADMIN_EMAIL],
      );
      console.log(`  · admin user updated: ${ADMIN_EMAIL}`);
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
