/* eslint-disable no-console */
// Tiny migration runner. Replaces the Prisma CLI.
//
// Layout it expects (relative to repo root):
//   server/db/migrations/*.sql      DDL applied in lexicographic order, tracked.
//   server/db/procedures/**/*.sql   CREATE OR REPLACE; reapplied on every run.
//
// CLI:
//   tsx src/db/migrate.ts apply     Apply pending migrations + reload procedures.
//   tsx src/db/migrate.ts status    Show applied / pending migrations.
//   tsx src/db/migrate.ts reset     DROP SCHEMA public CASCADE + recreate, then apply.

import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

const DB_DIR = path.resolve(__dirname, '../../db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');
const PROCEDURES_DIR = path.join(DB_DIR, 'procedures');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function readSqlFiles(dir: string, recursive = false): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...readSqlFiles(full, true));
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      out.push(full);
    }
  }

  return out.sort();
}

async function appliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM _migrations',
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function applyMigration(file: string): Promise<void> {
  const filename = path.basename(file);
  const sql = fs.readFileSync(file, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [
      filename,
    ]);
    await client.query('COMMIT');
    console.log(`  ✓ migration applied: ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ✗ migration FAILED: ${filename}`);
    throw err;
  } finally {
    client.release();
  }
}

async function applyProcedures(): Promise<void> {
  const files = readSqlFiles(PROCEDURES_DIR, true);
  if (files.length === 0) {
    console.log('No procedures to load.');
    return;
  }
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    try {
      await pool.query(sql);
      console.log(`  ✓ procedure loaded: ${path.relative(PROCEDURES_DIR, file)}`);
    } catch (err) {
      console.error(`  ✗ procedure FAILED: ${path.relative(PROCEDURES_DIR, file)}`);
      throw err;
    }
  }
}

async function cmdApply(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  const pending = readSqlFiles(MIGRATIONS_DIR).filter(
    (f) => !applied.has(path.basename(f)),
  );

  if (pending.length === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`Applying ${pending.length} migration(s)…`);
    for (const file of pending) {
      await applyMigration(file);
    }
  }

  console.log('Reloading procedures…');
  await applyProcedures();
}

async function cmdStatus(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  const all = readSqlFiles(MIGRATIONS_DIR);
  console.log('Migrations:');
  for (const file of all) {
    const name = path.basename(file);
    console.log(`  ${applied.has(name) ? '✓' : '·'}  ${name}`);
  }
  const pending = all.filter((f) => !applied.has(path.basename(f))).length;
  console.log(`\n${applied.size} applied, ${pending} pending.`);
}

async function cmdReset(): Promise<void> {
  console.log('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('GRANT ALL ON SCHEMA public TO PUBLIC');
  await cmdApply();
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'apply';
  try {
    if (cmd === 'apply') await cmdApply();
    else if (cmd === 'status') await cmdStatus();
    else if (cmd === 'reset') await cmdReset();
    else {
      console.error(`Unknown command: ${cmd}`);
      console.error('Usage: tsx src/db/migrate.ts [apply|status|reset]');
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
