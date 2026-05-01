# Database artifacts

This folder owns every SQL artifact that ships with the backend. It replaces
the Prisma schema, migrations, and seed file that lived under `prisma/`.

```
db/
├── migrations/      DDL applied in lexicographic order, tracked in _migrations
├── procedures/      CREATE OR REPLACE FUNCTION/PROCEDURE; reapplied on every run
│   ├── _common/     helpers used by multiple modules (audit, code generators, …)
│   ├── users/
│   ├── zones/
│   └── …
└── seeds/           Idempotent INSERTs and config rows. Loaded by `pnpm db:seed`.
```

## Conventions

- **Naming**
  - `fn_<entity>_<action>` for functions that return data.
  - `sp_<entity>_<action>` for procedures or functions that orchestrate
    transactions (multi-table writes, audit, etc.).
  - Parameters are prefixed `p_` (`p_email`, `p_family_id`).
- **Idempotency**: every file inside `procedures/` uses
  `CREATE OR REPLACE FUNCTION/PROCEDURE`. The runner reapplies them on each
  `pnpm db:migrate`, so any reference rot fails fast.
- **Errors are typed** via custom SQLSTATEs starting with `SH`:

  | SQLSTATE | HTTP | Meaning             |
  | -------- | ---- | ------------------- |
  | `SH401`  | 401  | UNAUTHORIZED        |
  | `SH403`  | 403  | FORBIDDEN           |
  | `SH404`  | 404  | NOT_FOUND           |
  | `SH409`  | 409  | CONFLICT            |
  | `SH422`  | 422  | UNPROCESSABLE       |
  | `SH423`  | 423  | LOCKED              |

  Raise them with
  `RAISE EXCEPTION '<message>' USING ERRCODE = 'SH4XX';`. The Node side maps
  them to `AppError` in `src/types/pg-errors.ts`.
- **Transactions live inside SPs**. A multi-table mutation (donation,
  delivery, relocation, …) is one SP that opens its own transaction (or
  PROCEDURE … COMMIT). Node never opens transactions from the client.
- **Auditing** (issue #28): every mutating SP will call
  `sp_audit_insert(action, module, entity, entity_id, user_id, before, after,
  ip, user_agent)` before returning. The controller propagates IP and
  user-agent down to the service.

## Migration runner

`src/db/migrate.ts` is a tiny TypeScript CLI that uses only `pg`:

| Command                      | Effect |
| ---------------------------- | ------ |
| `pnpm db:migrate`            | Apply pending migrations + reload all procedures |
| `pnpm db:status`             | Print applied / pending migrations |
| `pnpm db:reset`              | Drop the public schema and rerun migrate + seed (dev only) |
| `pnpm db:seed`               | Seed data (admin user via Node, then `db/seeds/*.sql`) |

Migrations are tracked in a `_migrations` table that the runner creates on
first use. Each migration runs inside its own transaction; if it fails, the
runner aborts.

## Seed strategy

The admin user requires a bcrypt hash, which lives in Node — not in
PostgreSQL. So `src/db/seed.ts` runs in two phases:

1. Compute `bcrypt.hash(ADMIN_PASSWORD)` and call
   `SELECT fn_users_create($1, $2, 'ADMIN')`. `ON CONFLICT (email)` is handled
   by the `SH409` raised by the SP — the runner ignores it.
2. Execute every `db/seeds/*.sql` file in lexicographic order.
