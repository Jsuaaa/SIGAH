# Migración SIGAH — Prisma → MVC + Stored Procedures

> Resumen del refactor que removió Prisma del stack y adoptó arquitectura
> MVC + Service layer con stored procedures de PostgreSQL.
> Fecha: 2026-04-29 · Issue de referencia: **#9.2**

---

## Decisiones tomadas

| Pregunta | Respuesta |
|---|---|
| Arquitectura | **MVC + Service layer** (Models + Services + Controllers + Views) |
| Lógica de negocio | **DB-centric** — toda RN-01..RN-10 + recálculos + transacciones viven en SPs |
| Migraciones | **Runner casero + .sql planos** (sin librerías externas) |
| Migraciones existentes | **Wipe** (descartar Prisma migrations, empezar de cero) |

---

## Documentación actualizada

- **`PLAN.md`** — stack, arquitectura MVC + Service layer, estructura
  `db/` y `src/`, convenciones de SPs, mapeo RN → SP, paso 3.2 nuevo,
  verification reescrita.
- **`ISSUES.md`** — patrón estándar post-#9.2 al inicio, issue #9.2
  detallado, issues #10–#28 reformulados como "Tabla X + procedures",
  dependency graph, renumeración y trazabilidad RN → SP actualizadas.

---

## Código refactorizado (auth + zones vía SPs)

### SQL artifacts nuevos

```
server/db/
├── migrations/
│   ├── 001_extensions.sql       pgcrypto + pg_trgm
│   ├── 002_enum_types.sql       role + risk_level
│   ├── 003_users.sql            tabla users + trigger updated_at
│   └── 004_zones.sql            tabla zones + índice trigram
├── procedures/
│   ├── users/
│   │   ├── fn_users_find_by_email.sql
│   │   ├── fn_users_find_by_id.sql
│   │   ├── fn_users_create.sql           SH409 si email duplicado
│   │   └── sp_users_change_password.sql  SH404 si user no existe
│   └── zones/
│       ├── fn_zones_create.sql           SH409 si name duplicado
│       ├── fn_zones_find_by_id.sql
│       ├── fn_zones_list.sql             retorna (data jsonb, total bigint)
│       ├── fn_zones_update.sql           SH404 / SH409
│       ├── sp_zones_delete.sql           SH404 si no existe
│       ├── fn_zones_families.sql         stub hasta #12
│       ├── fn_zones_shelters.sql         stub hasta #11
│       └── fn_zones_warehouses.sql       stub hasta #15
├── seeds/
│   └── 002_zones_monteria.sql            5 zonas reales (admin user lo crea seed.ts)
└── README.md                              convenciones, errcodes SH4xx
```

### Capa TypeScript nueva

```
server/src/
├── config/
│   └── database.ts              ← pg.Pool singleton (reemplaza prisma.ts)
├── db/
│   ├── client.ts                query, queryOne, withTransaction, mapPgError
│   ├── migrate.ts               CLI: apply | status | reset
│   └── seed.ts                  bcrypt admin + ejecuta db/seeds/*.sql
├── models/                      ← M de MVC (wrappers tipados sobre SPs)
│   ├── user.model.ts            UserModel.{findByEmail,findById,create,changePassword}
│   └── zone.model.ts            ZoneModel.{create,findById,list,update,remove}
├── views/                       ← V de MVC (DTOs / serializers)
│   ├── user.view.ts             oculta password_hash
│   └── zone.view.ts             passthrough (sin secretos)
└── types/
    ├── entities.ts              Role, RiskLevel, User, Zone
    └── pg-errors.ts             SH4xx → AppError (401/403/404/409/422/423)
```

### Archivos refactorizados

- `server/src/services/auth.service.ts` — usa `UserModel` + bcrypt en Node.
- `server/src/services/zones.service.ts` — usa `ZoneModel`, sin
  `prisma.$transaction`.
- `server/src/controllers/zones.controller.ts` — `RiskLevel` desde
  `types/entities`.
- `server/src/middlewares/role.middleware.ts` — `Role` desde
  `types/entities`.
- `server/src/types/express.d.ts` — `Role` desde `types/entities`.
- `server/src/index.ts` — `pool.query('SELECT 1')` en lugar de
  `prisma.$connect()`.
- `server/tests/setup.ts` — `TRUNCATE … RESTART IDENTITY CASCADE`.

### Archivos eliminados

- `server/prisma/` (todo el directorio)
- `server/src/config/prisma.ts`
- `server/prisma.config.ts`

### `package.json`

| Antes | Ahora |
|---|---|
| `@prisma/client@^7`, `@prisma/adapter-pg@^7`, `prisma@^7` (devDep) | `pg@^8`, `@types/pg` (devDep) |
| Bloque `"prisma": { "seed": "..." }` | (eliminado) |
| (sin scripts db:*) | `db:migrate`, `db:status`, `db:reset`, `db:seed` |

Root `package.json`:

- `db:migrate` / `db:seed` ahora invocan al runner del server vía
  `pnpm --filter server`.
- `db:reset` encadena `down -v && up && db:migrate && db:seed`.

### Infra

- `Dockerfile` — sin `prisma generate`, sin `openssl`. Copia `db/`.
- `docker-entrypoint.sh` — corre `pnpm run db:migrate` (aplica
  migrations + recarga procedures idempotentes).
- `DEPLOYMENT.md` — comandos actualizados (`pnpm run db:migrate`,
  `pnpm run db:seed`).
- `.claude/agents/sigah-reviewer.md` — reglas adaptadas a SPs/MVC.
- `.claude/settings.local.json` — quitado permiso `Bash(npx prisma:*)`.

---

## Convenciones quedaron documentadas en `server/db/README.md`

- **Naming**: `fn_<entidad>_<acción>` para FUNCTIONS;
  `sp_<entidad>_<acción>` para PROCEDURES o transacciones complejas.
  Parámetros prefijados `p_`.
- **Errores**: `RAISE EXCEPTION USING ERRCODE = 'SH4XX'`. Mapping:

  | SQLSTATE | HTTP | Significado     |
  | -------- | ---- | --------------- |
  | `SH401`  | 401  | UNAUTHORIZED    |
  | `SH403`  | 403  | FORBIDDEN       |
  | `SH404`  | 404  | NOT_FOUND       |
  | `SH409`  | 409  | CONFLICT        |
  | `SH422`  | 422  | UNPROCESSABLE   |
  | `SH423`  | 423  | LOCKED          |

- **Transacciones** viven dentro de los SPs. Node solo abre transacción
  vía `withTransaction` en los pocos casos cross-service (tests).
- **Auditoría** (issue #28): cada SP de mutación llamará a
  `sp_audit_insert(...)` antes de retornar.
- **bcrypt** sigue en Node — única lógica que NO baja a la BD.

---

## Verificaciones

### ✅ Pasan ahora (offline)

- `pnpm --filter server typecheck` sin errores.
- `grep -rn "prisma\|@prisma"` solo devuelve líneas legítimas en docs
  (issue #9.2 y `db/README.md`).
- Estructura nueva completa y cohesiva.

### 🟡 Pendientes — requieren Docker

```sh
pnpm db:up                # levantar postgres
pnpm db:reset             # drop + migrate + seed
cd server && pnpm test    # 52 tests de zones contra BD real
```

Si algo rompe en `fn_zones_list` o el cleanup de `tests/setup.ts`, se
afina sobre la marcha — el shape de respuesta se mantiene exactamente
igual al de Prisma para no tocar los asserts.

---

## Próximos pasos

1. Ejecutar verificaciones online con Docker corriendo.
2. Si los 52 tests de zones pasan, marcar #9.2 como ✅ y avanzar a
   #11 (Refugios) sobre el patrón nuevo.
3. Aplicar #9.1 (auth final) como una migración SQL adicional encima
   de #9.2 — añade los 4 roles nuevos al enum `role`, los 6 campos a
   `users`, e implementa `sp_auth_login` con lockout.
