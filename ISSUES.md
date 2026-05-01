# SIGAH — Project Issues (34)

> Issues derivados de PLAN.md y FRONTEND-PLAN.md, alineados al PDF de requerimientos finales (Iteración 3, Abril 2026 — 44 RF, 10 RN, 9 RNF, 31 HU). Cada issue incluye título, descripción, criterios de aceptación, dependencias y etiquetas sugeridas.
>
> **Estado**: los issues **#1–#9 están resueltos** (scaffolding + infraestructura base + auth v1). El issue **#9.1** adapta el módulo de auth al enum de roles y validaciones finales. **El issue #9.2 elimina Prisma del stack y adopta arquitectura MVC + Stored Procedures (PL/pgSQL); a partir de él, todos los issues siguen el patrón estándar descrito abajo.**

---

## Patrón estándar de implementación (post-#9.2)

Toda nueva entidad o feature se entrega siguiendo este patrón. Reemplaza al modelo Prisma anterior:

1. **Migración SQL** (`server/db/migrations/NNN_<entidad>.sql`): DDL puro — tabla, FKs, CHECK constraints, índices, enums (si aplica). Numerada y registrada en `_migrations`.
2. **Stored procedures** (`server/db/procedures/<módulo>/*.sql`): un archivo por SP/FN, idempotente (`CREATE OR REPLACE`). Convenciones:
   - `fn_<entidad>_<acción>` para FUNCTIONS que devuelven datos.
   - `sp_<entidad>_<acción>` para PROCEDURES o FUNCTIONS que orquestan transacciones complejas.
   - Errores con `RAISE EXCEPTION USING ERRCODE = 'SH4XX'` (`SH401/403/404/409/422/423`).
   - Cada SP de mutación llama a `sp_audit_insert(...)` antes de retornar.
   - Las transacciones que cruzan tablas viven enteras dentro del SP.
3. **Tipos TS** (`server/src/types/entities.ts`): interface espejo de la tabla + cualquier enum nuevo.
4. **Model** (`server/src/models/<entidad>.model.ts`): wrapper tipado sobre `db.query('SELECT * FROM fn_<x>($1, $2)', […])`. Sin lógica de negocio.
5. **Service** (`server/src/services/<entidad>.service.ts`): orquesta varios models, JWT, bcrypt; **no replica reglas que ya estén en SP**.
6. **Controller + Routes + Validators**: igual que hoy. Validators solo para **forma** (regex, longitud); reglas de negocio quedan en SP.
7. **View** (`server/src/views/<entidad>.view.ts`): serializa la fila a la respuesta pública (oculta `password_hash`, etc.).
8. **AC genéricos que aplican a todo issue**:
   - SPs idempotentes en `db/procedures/<módulo>/`.
   - Cada AC funcional cubierto por SP correspondiente, no por código TS replicado.
   - Modelo expone solo métodos tipados; ningún controller/service llama `db.query` directo.
   - Tests de integración invocan los SPs reales contra BD de test.

---

## Paso 1: Inicialización del proyecto

### Issue #1 — Scaffolding y dependencias (monolito) ✅
**Labels**: `setup`, `priority: critical`, `step-1`
**Estado**: Completado

Inicialización del monolito con `server/` y `client/`. Scripts raíz con `concurrently`. Scaffolding de Vite + React + TypeScript. Instalación de todas las dependencias de producción y dev.

---

### Issue #2 — Variables de entorno y git config ✅
**Labels**: `setup`, `priority: critical`, `step-1`
**Estado**: Completado

`.env.example`, `.env`, `.gitignore` (cubre node_modules/, .env, prisma db, client/dist/).

---

### Issue #3 — Prisma init y config modules ✅
**Labels**: `setup`, `database`, `priority: critical`, `step-1`
**Estado**: Completado

`schema.prisma` con PostgreSQL, `config/env.ts`, `config/prisma.ts` (singleton + PrismaPg adapter), `config/constants.ts`.

---

## Paso 2: Infraestructura base

### Issue #4 — Express app.ts ✅
**Labels**: `infrastructure`, `priority: critical`, `step-2`
**Estado**: Completado

Express config con cors, helmet, morgan, json parser. Healthcheck en `/api/v1/health`. Servir `client/dist/` en producción con SPA fallback.

---

### Issue #5 — Server entry index.ts ✅
**Labels**: `infrastructure`, `priority: critical`, `step-2`
**Estado**: Completado

Arranque con `prisma.$connect()` previo. Log de puerto y NODE_ENV.

---

### Issue #6 — Utilidades y error handler global ✅
**Labels**: `infrastructure`, `priority: critical`, `step-2`
**Estado**: Completado

`AppError`, `asyncHandler`, `pagination`, `errorHandler.middleware`, `validate.middleware`.

---

## Paso 3: Autenticación (v1)

### Issue #7 — Modelo User y migración ✅
**Labels**: `database`, `auth`, `priority: critical`, `step-3`
**Estado**: Completado

> ⚠️ **Nota**: el enum `Role` inicial incluía `ADMIN/COORDINATOR/OPERATOR/VIEWER`. Esto se reajusta en **#9.1** al enum final de 6 valores. El rol VIEWER se reemplaza por FUNCIONARIO_CONTROL.

---

### Issue #8 — Auth service, controller, routes ✅
**Labels**: `auth`, `priority: critical`, `step-3`
**Estado**: Completado

Register/login/getProfile/changePassword. JWT 8h con payload `{ id, email, role }`. Validators con password mínimo 6 chars (se endurece a 8 en #9.1).

---

### Issue #9 — Auth + role middlewares + admin seed ✅
**Labels**: `auth`, `middleware`, `priority: critical`, `step-3`
**Estado**: Completado

`auth.middleware`, `role.middleware` (factory `authorize(...roles)`), seed idempotente de admin.

---

## Paso 3.1: Adaptación de Auth al PDF final

### Issue #9.1 — Adaptación del módulo Auth a requerimientos finales (roles, bloqueo, nombre, contraseña) 🆕
**Labels**: `auth`, `migration`, `priority: critical`, `step-3`
**Depends on**: #9

Ajustar el módulo de auth ya entregado para cumplir con el PDF final. NO requiere revertir nada — todos los cambios son aditivos mediante una nueva migración.

**Cambios técnicos**:
1. **Migración Prisma `add-roles-and-user-fields`**:
   - Renombrar enum `Role` a los 6 valores finales: `ADMIN`, `CENSADOR`, `OPERADOR_ENTREGAS`, `COORDINADOR_LOGISTICA`, `FUNCIONARIO_CONTROL`, `REGISTRADOR_DONACIONES`. Antes de aplicar, reasignar el admin seedeado a `ADMIN` (sigue siendo el único usuario).
   - Añadir a `User`: `name String`, `is_active Boolean @default(true)`, `failed_login_attempts Int @default(0)`, `locked_until DateTime?`, `last_login_at DateTime?`, `password_must_change Boolean @default(false)`.
2. **`auth.validator.ts`**: password mínimo 8 caracteres (HU-03 CA3). `registerRules` con los 6 roles. `name` requerido en register.
3. **`auth.service.ts`**:
   - `login`: si `is_active=false` → 403. Incrementa `failed_login_attempts` en cada fallo; al llegar a 5, setea `locked_until = now + 15min`. Si `locked_until > now` → 423. Al loguear correctamente, resetea contador y actualiza `last_login_at`.
   - `register`: persiste `name`; al crear usuario setea `password_must_change=true` (contraseña temporal — HU-01 CA5).
   - `changePassword`: al éxito, `password_must_change=false`.
   - Nuevo método `resetPassword(userId)` (ADMIN) que genera password temporal.
   - Nuevo método `setActive(userId, active)` (ADMIN) — activar/desactivar.
4. **`auth.routes.ts`**: añadir `POST /reset-password/:userId`, `PUT /users/:id`, `GET /users` (ADMIN).
5. **`seed.ts`**: añadir `name: 'Administrador SIGAH'`.
6. **`constants.ts`**:
   - `CODE_PREFIXES.DELIVERY = 'ENT'` (RN-07)
   - `WAREHOUSE_CAPACITY_ALERT_THRESHOLD = 0.85` (HU-11 CA3)
   - Añadir `FAILED_LOGIN_LIMIT = 5`, `ACCOUNT_LOCK_MINUTES = 15`, `MIN_PASSWORD_LENGTH = 8`.
7. **`types/express.d.ts`**: payload JWT añade `name`.

**Acceptance Criteria**:
- [ ] Migración aplica sin pérdida de datos (admin queda con rol ADMIN).
- [ ] Login incorrecto 5 veces bloquea la cuenta 15 min con respuesta 423.
- [ ] Usuario con `is_active=false` recibe 403 en login.
- [ ] Register exige `name` y rechaza roles fuera del nuevo enum.
- [ ] `password_must_change=true` tras register y reset; `false` tras changePassword.
- [ ] ADMIN puede resetear contraseña de cualquier usuario (`POST /auth/reset-password/:id`).
- [ ] ADMIN puede activar/desactivar usuarios (`PUT /auth/users/:id`).
- [ ] Validator rechaza contraseñas <8 caracteres.
- [ ] Tests: login lockout, usuario desactivado, register con nombre, rol inválido, reset de contraseña.

---

## Paso 3.2: Eliminación de Prisma + arquitectura MVC + Stored Procedures

### Issue #9.2 — Migración a `pg` + arquitectura MVC + Stored Procedures 🆕
**Labels**: `infrastructure`, `database`, `priority: critical`, `step-3.2`
**Depends on**: #9.1

Cambio fundacional: el profesor pide que el proyecto **no use ORM** y que toda la lógica de negocio viva en **stored procedures de PostgreSQL**. Se elimina Prisma del stack y se adopta `pg` (node-postgres) puro como única dependencia de acceso a datos. El backend pasa a una arquitectura **MVC + Service layer** donde los modelos son wrappers tipados sobre `fn_*`/`sp_*`, los servicios orquestan, los controllers transportan HTTP y las vistas serializan respuestas. Las migraciones Prisma vigentes se descartan; arrancamos `db/migrations/` desde cero con `.sql` planos. Solo `auth` y `zones` están implementados al momento del cambio, así que el alcance del issue se limita a esos dos módulos; #10 en adelante se construye directamente sobre el nuevo patrón.

**Cambios técnicos**:

1. **Dependencias** (`server/package.json`):
   - Quitar: `@prisma/client`, `@prisma/adapter-pg`, `prisma` (devDep), bloque `"prisma": { "seed": "..." }`.
   - Añadir: `pg@^8`, `@types/pg` (devDep).
   - Scripts `db:migrate`, `db:status`, `db:seed`, `db:reset` apuntando a `tsx src/db/migrate.ts` / `src/db/seed.ts`.
2. **Estructura nueva**:
   - `server/db/migrations/` — `.sql` numerados (`001_extensions.sql`, `002_enum_types.sql`, `003_users.sql`, `004_zones.sql`).
   - `server/db/procedures/{_common,users,zones}/*.sql` — `CREATE OR REPLACE` idempotentes.
   - `server/db/seeds/{001_admin_user.sql,002_zones_monteria.sql}`.
   - `server/db/README.md` con convenciones de naming, errcodes `SH4xx`, y guía para añadir SPs.
   - `server/src/db/{client.ts,migrate.ts,seed.ts}` — runner casero.
   - `server/src/config/database.ts` — `pg.Pool` singleton (reemplaza `config/prisma.ts`).
   - `server/src/{models,views}/` — nuevas carpetas.
   - `server/src/types/{entities.ts,pg-errors.ts}` — interfaces TS + mapping SQLSTATE → AppError.
3. **Stored procedures iniciales**:
   - `_common/`: `fn_next_code(p_prefix)`, `sp_audit_insert(...)` (placeholder; se completa en #28).
   - `users/`: `fn_users_find_by_email`, `fn_users_find_by_id`, `fn_users_create`, `fn_users_list`, `sp_auth_login` (lockout + last_login_at), `sp_users_change_password`, `sp_users_reset_password`, `sp_users_set_active`.
   - `zones/`: `fn_zones_create`, `fn_zones_list` (con paginación + filtros + total), `fn_zones_find_by_id`, `fn_zones_update`, `sp_zones_delete`, `fn_zones_families`, `fn_zones_shelters`, `fn_zones_warehouses`.
4. **Migration runner** (`src/db/migrate.ts`):
   - Crea tabla `_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`.
   - Lee `db/migrations/*.sql` ordenados, aplica los pendientes en transacción individual.
   - Después, recarga **todos** los `db/procedures/**/*.sql` (recursivo) sin tracking — son idempotentes.
   - CLI: `apply` | `status` | `reset` (drop schema public + recrea).
5. **Refactor de código**:
   - `auth.service.ts`: usa `UserModel`; bcrypt sigue en Node; lockout/contadores delegados a `sp_auth_login`.
   - `zones.service.ts`: usa `ZoneModel`; `prisma.$transaction([find, count])` → `fn_zones_list` que retorna fila con `data + total`.
   - `controllers/zones.controller.ts`, `middlewares/role.middleware.ts`, `types/express.d.ts`: `import { Role } from '../types/entities'` (sin `@prisma/client`).
   - `tests/setup.ts`: cleanup con `TRUNCATE users, zones RESTART IDENTITY CASCADE`, salvo el admin seedeado.
   - `index.ts`: `pool.query('SELECT 1')` como healthcheck en lugar de `prisma.$connect()`.
6. **Errores tipados**: `src/types/pg-errors.ts` exporta `mapPgError(err)` que lee `err.code` y, si es `SH4xx`, lanza `AppError` con statusCode correcto.
7. **Borrar**: `server/prisma/` (todo el directorio), `server/src/config/prisma.ts`.
8. **Documentación**: actualizar `ONBOARD.md` con `pnpm db:reset` como paso de setup.

**Acceptance Criteria**:
- [ ] `grep -r "prisma\|@prisma" server/src server/tests server/package.json` no devuelve nada.
- [ ] `pnpm install && pnpm db:reset` deja la BD con `users` (1 admin), `zones` (5 Montería) y todos los SPs creados.
- [ ] `SELECT count(*) FROM pg_proc WHERE proname LIKE 'fn_%' OR proname LIKE 'sp_%'` retorna ≥ 16 (los listados arriba).
- [ ] `pnpm --filter server test` pasa la suite existente de zones (52 tests) sin tocar los asserts.
- [ ] `pnpm --filter server typecheck && pnpm --filter server build` sin errores.
- [ ] Login con admin: éxito → `last_login_at` actualizado, `failed_login_attempts = 0`.
- [ ] 5 logins fallidos consecutivos: respuesta 423, `locked_until ≈ now() + 15min`. Lógica enforzada por `sp_auth_login`.
- [ ] Cada modelo tiene su `*.model.ts` con métodos tipados; ningún controller/service llama `db.query` directamente.
- [ ] Errores PostgreSQL `SH4xx` se mapean a HTTP 401/403/404/409/422/423 vía `mapPgError`.
- [ ] Tests nuevos: `tests/integration/auth.test.ts` cubre login OK, lockout (5 fallos → 423), usuario desactivado (403), reset de contraseña.
- [ ] `db/README.md` documenta convenciones de naming y errcodes.

---

## Paso 4: Zonas y refugios

### Issue #10 — Tabla Zone + CRUD via SPs + seed de Montería
**Labels**: `feature`, `geo`, `step-4`
**Depends on**: #9.2

Tabla `zones` (name, risk_level LOW/MEDIUM/HIGH/CRITICAL, latitude, longitude, estimated_population Int) — DDL en `db/migrations/004_zones.sql` (ya creada en #9.2). Implementar `ZoneModel` que envuelve los SPs de `db/procedures/zones/`: `fn_zones_create`, `fn_zones_list` (filtros + paginación + total), `fn_zones_find_by_id`, `fn_zones_update`, `sp_zones_delete`, `fn_zones_families`, `fn_zones_shelters`, `fn_zones_warehouses`. CRUD completo. Endpoints anidados. Seed con zonas reales de la margen izquierda de Montería en `db/seeds/002_zones_monteria.sql`.

**Acceptance Criteria**:
- [ ] Zone model con coordenadas NOT NULL (RN-10).
- [ ] CRUD + endpoints anidados.
- [ ] Validators: risk_level enum, rangos de coordenadas.
- [ ] Protección de rol: crear/editar/eliminar requiere ADMIN o COORDINADOR_LOGISTICA.
- [ ] Seed con zonas reales.

---

### Issue #11 — Tabla Shelter + SPs + alerta 90%
**Labels**: `feature`, `geo`, `step-4`
**Depends on**: #10

Migración `db/migrations/NNN_shelters.sql` con tabla `shelters` (name, address, zone_id FK, max_capacity Int, current_occupancy Int default 0, type, latitude NOT NULL, longitude NOT NULL — RN-10). SPs en `db/procedures/shelters/`: `fn_shelters_create`, `fn_shelters_list` (incluye flag `is_over_capacity` si >90%), `fn_shelters_find_by_id`, `fn_shelters_update`, `sp_shelters_delete`, `sp_shelters_set_occupancy` (valida `<= max_capacity` y lanza `SH422` si excede). `ShelterModel` + service + controller + routes + view. PUT `/:id/occupancy` invoca `sp_shelters_set_occupancy`.

**Acceptance Criteria**:
- [ ] Shelter con coordenadas obligatorias.
- [ ] `PUT /:id/occupancy` valida occupancy <= max_capacity.
- [ ] Endpoint lista incluye flag `is_over_capacity` si >90%.
- [ ] Filtrable por zone_id.
- [ ] Seed con refugios.

---

## Paso 5: Familias, personas y consentimiento privacidad

### Issue #12 — Tablas Family + PrivacyConsent + SPs con código secuencial
**Labels**: `feature`, `census`, `priority: high`, `step-5`
**Depends on**: #10

Migración con dos tablas:
- `families` (family_code único, head_document, zone_id FK, shelter_id FK opcional, num_members, num_children_under_5, num_adults_over_65, num_pregnant, num_disabled, priority_score Float default 0, **priority_score_breakdown JSONB**, status enum **ACTIVO/EN_REFUGIO/EVACUADO**, latitude opcional, longitude opcional, reference_address opcional).
- `privacy_consents` (family_id FK, accepted_at, accepted_by_user_id FK, law_version "Ley 1581/2012", ip_address).
- Índices `pg_trgm` sobre `family_code`, `head_document`, `reference_address` (RNF-04).

SPs en `db/procedures/families/`:
- `sp_families_create_with_consent(p_family JSONB, p_consent JSONB, p_user_id, p_ip, p_user_agent)` — atómico: valida `privacy_consent_accepted=true` (RN-09 → `SH422`), genera `FAM-2026-NNNNN` con `fn_next_code('FAM')`, inserta `families` + `privacy_consents`, audita.
- `fn_families_search(p_query TEXT, p_limit, p_offset)` — búsqueda unificada con trigram, retorna fila con `data + total`.
- `fn_families_get_eligibility(p_family_id)` — delega en `fn_delivery_check_eligibility` cuando exista (#23).
- `fn_families_list`, `fn_families_find_by_id`, `sp_families_update`, `sp_families_delete`, `fn_families_deliveries`.

**Acceptance Criteria**:
- [ ] `POST /families` exige `privacy_consent_accepted=true`; si no, 400 (RN-09).
- [ ] Persiste PrivacyConsent en la misma transacción que Family.
- [ ] Código FAM secuencial generado automáticamente (RN-07).
- [ ] `num_members > 0` validado.
- [ ] Status enum es ACTIVO/EN_REFUGIO/EVACUADO.
- [ ] Búsqueda unificada responde <2s con 12.000 familias (RNF-04).
- [ ] Filtrable por zone_id, status, shelter_id; ordenable por priority_score.

---

### Issue #13 — Tabla Person + SPs
**Labels**: `feature`, `census`, `step-5`
**Depends on**: #12

Migración con tabla `persons` (family_id FK, name, document único, birth_date, gender, relationship enum **ESPOSO_A/HIJO_A/PADRE_MADRE/HERMANO_A/OTRO**, special_conditions TEXT[], requires_medication Boolean). SPs en `db/procedures/persons/`: `fn_persons_list_by_family`, `fn_persons_find_by_document`, `sp_persons_create`, `sp_persons_update`, `sp_persons_delete` (bloqueado si es el último miembro de la familia → `SH409`). `PersonModel` + service + controller + routes + view. Búsqueda por documento retorna persona + datos de familia (JOIN dentro del SP).

**Acceptance Criteria**:
- [ ] Person con relación a Family.
- [ ] `special_conditions` como array (valores: CHILD_UNDER_5, ELDERLY_OVER_65, PREGNANT, DISABLED).
- [ ] Creación/edición/borrado actualiza aggregate counts en Family.
- [ ] Búsqueda por documento retorna persona + info de familia.

---

### Issue #14 — Sync composición ↔ puntaje + recálculo automático
**Labels**: `feature`, `census`, `step-5`
**Depends on**: #13, #20 (scoring_config)

Al agregar/remover/editar personas, recalcular: num_members, num_children_under_5 (birth_date), num_adults_over_65, num_pregnant, num_disabled. Invocar servicio de priorización para actualizar `priority_score` (lee `scoring_config`). No permitir eliminar la última persona de una familia (num_members >= 1).

**Acceptance Criteria**:
- [ ] Aggregate counts actualizados en cada mutación de Person.
- [ ] Edades calculadas de `birth_date`.
- [ ] `priority_score` recalculado tras cualquier cambio de composición (RN-08).
- [ ] Bloqueo al eliminar último miembro.
- [ ] Auditoría registra before/after en cambios.

---

## Paso 6: Bodegas, recursos e inventario

### Issue #15 — Tabla Warehouse + SPs con alerta 85% y bloqueo 100%
**Labels**: `feature`, `inventory`, `geo`, `step-6`
**Depends on**: #10

Migración con tabla `warehouses` (name, address, latitude NOT NULL, longitude NOT NULL — RN-10, max_capacity_kg, current_weight_kg default 0, status ACTIVE/INACTIVE, zone_id FK; CHECK `current_weight_kg <= max_capacity_kg`). SPs en `db/procedures/warehouses/`: `fn_warehouses_create`, `fn_warehouses_list` (incluye flag `is_over_85_percent`), `fn_warehouses_find_by_id`, `fn_warehouses_update`, `sp_warehouses_delete`, `fn_warehouses_inventory`, `fn_warehouses_nearest(p_lat, p_lng)` (Haversine en SQL, sólo ACTIVE con stock). Cualquier mutación que haga `current_weight_kg > max_capacity_kg` lanza `SH422` (RN-03).

**Acceptance Criteria**:
- [ ] Coordenadas obligatorias (RN-10).
- [ ] Lista incluye `is_over_85_percent` flag (HU-11 CA3).
- [ ] Cualquier operación que haga `current_weight_kg > max_capacity_kg` rechaza con 400 (HU-11 CA4, RN-03).
- [ ] Filtrable por zone_id, status.
- [ ] Seed con bodegas reales de Montería sumando 20.000 kg.

---

### Issue #16 — ResourceTypes + Inventory + InventoryAdjustment con motivo
**Labels**: `feature`, `inventory`, `step-6`
**Depends on**: #15

Migraciones para tres tablas:
- `resource_types` (name, category FOOD/BLANKET/MATTRESS/HYGIENE/MEDICATION, unit_of_measure, unit_weight_kg, **is_active Boolean default true**; unique (name, category)).
- `inventory` (warehouse_id FK, resource_type_id FK, available_quantity, total_weight_kg, batch, expiration_date; unique (warehouse_id, resource_type_id, batch)).
- `inventory_adjustments` (inventory_id FK, delta Int, **reason enum MERMA/DANO/DEVOLUCION/CORRECCION**, reason_note, user_id FK, created_at).

SPs en `db/procedures/{resource_types,inventory}/`:
- `fn_resource_types_*` (CRUD; soft-delete con `is_active=false`).
- `fn_inventory_list(p_warehouse_id)`, `fn_inventory_summary` (agrupado por categoría/bodega).
- `sp_inventory_adjust(p_inventory_id, p_delta, p_reason, p_reason_note, p_user_id, p_ip, p_user_agent)` — atómico: valida `reason` enum y `available_quantity + delta >= 0` (`SH422`), actualiza `inventory`, ajusta `warehouses.current_weight_kg` (RN-03), inserta en `inventory_adjustments`, audita. Solo ADMIN/COORDINADOR_LOGISTICA (validado en controller).

**Acceptance Criteria**:
- [ ] Unique (name, category) en ResourceType (HU-14 CA2).
- [ ] Soft-delete con `is_active=false` en vez de DELETE (HU-14 CA4).
- [ ] Categoría enum completa del PDF (incluye MEDICATION).
- [ ] `PUT /inventory/:id/adjustment` exige `reason` enum + `reason_note` (HU-17 CA1-2).
- [ ] Rechaza ajustes que dejen stock < 0 (HU-17 CA3).
- [ ] Actualiza `current_weight_kg` de la bodega en la misma transacción.
- [ ] Solo ADMIN/COORDINADOR_LOGISTICA pueden ajustar (HU-17 CA5).
- [ ] Registro en `audit_logs` (vía middleware #28).
- [ ] Resumen agregado por categoría / bodega.
- [ ] Seed con catálogo base (arroz, frijoles, agua, cobijas, jabón, botiquines, etc.).

---

### Issue #17 — Alertas configurables + bodega más cercana
**Labels**: `feature`, `inventory`, `geo`, `step-6`
**Depends on**: #16

Migración con tabla `alert_thresholds` (resource_type_id FK, min_quantity Int, updated_by FK, updated_at). SPs: `fn_alert_thresholds_list`, `sp_alert_thresholds_set`. Endpoints `GET /alert-thresholds`, `PUT /alert-thresholds`.

`GET /inventory/alerts` — retorna stock bajo (por umbral configurable), vencimientos próximos (7 días), vencidos, bodegas >85%.

`GET /warehouses/nearest?lat=X&lng=Y` — Haversine, solo bodegas ACTIVE con stock > 0.

**Acceptance Criteria**:
- [ ] Umbrales configurables por recurso (HU-16 CA2).
- [ ] Alertas incluyen severidad y enlace a la bodega.
- [ ] Nearest solo ACTIVE con stock y calcula distancia.
- [ ] Si no hay bodega con disponibilidad, mensaje claro (HU-12 CA4).

---

## Paso 7: Donantes y donaciones

### Issue #18 — Tabla Donor con nuevo enum y contact requerido
**Labels**: `feature`, `donations`, `step-7`
**Depends on**: #9.2

Migración con tabla `donors` (name, **type enum PERSONA_NATURAL/EMPRESA/ALCALDIA/GOBERNACION/ORGANIZACION**, contact String (requerido — teléfono o correo), tax_id opcional; **unique compuesto (name, type)** — HU-18 CA3). SPs en `db/procedures/donors/`: `fn_donors_create`, `fn_donors_list` (filtros), `fn_donors_find_by_id`, `sp_donors_update`, `sp_donors_soft_delete` (marca inactivo si tiene donaciones).

**Acceptance Criteria**:
- [ ] 5 valores del enum coinciden con HU-18 CA1.
- [ ] `contact` required (HU-18 CA2).
- [ ] Unique (name, type) a nivel BD.
- [ ] Filtrable por tipo.
- [ ] Soft-delete si tiene donaciones asociadas (marcar inactivo, no borrar).

---

### Issue #19 — Donación transaccional con inventario
**Labels**: `feature`, `donations`, `inventory`, `priority: high`, `step-7`
**Depends on**: #16, #18

Migración con dos tablas:
- `donations` (donation_code DON-2026-NNNNN, donor_id FK, destination_warehouse_id FK, donation_type IN_KIND/MONETARY/MIXED, monetary_amount opcional, date).
- `donation_details` (donation_id FK, resource_type_id FK, quantity, weight_kg).

SP `sp_donations_create(p_donation JSONB, p_details JSONB[], p_user_id, p_ip, p_user_agent)` — transacción interna PL/pgSQL que: genera código DON con `fn_next_code('DON')`, crea `donations` + `donation_details`, actualiza `inventory` y `warehouses.current_weight_kg`, valida `<= max_capacity_kg` (rollback con `SH422` si excede — RN-03), audita. Para `MONETARY` no toca inventario. SPs adicionales: `fn_donations_list` (filtros), `fn_donations_find_by_id`, `fn_donations_by_donor` (HU-20).

**Acceptance Criteria**:
- [ ] Código DON secuencial.
- [ ] Atomic: inventario + peso se actualizan o todo se revierte.
- [ ] Rechaza si excede `max_capacity_kg` de la bodega (HU-19 CA3).
- [ ] Monetary-only no afecta inventario.
- [ ] `GET /donations` con filtros (donor, type, date range).
- [ ] `GET /donors/:id/donations` retorna historial ordenado por fecha desc (HU-20 CA1).

---

## Paso 8: Priorización configurable

### Issue #20 — ScoringConfig + servicio de priorización 🆕
**Labels**: `feature`, `algorithm`, `priority: high`, `step-8`
**Depends on**: #12

Migración con tabla `scoring_config` (key PK, value Float, updated_by FK, updated_at). Seed (`db/seeds/NNN_scoring_config.sql`) con pesos iniciales (W_MEMBERS=2, W_CHILDREN_5=5, W_ADULTS_65=4, W_PREGNANT=5, W_DISABLED=4, W_ZONE_RISK=3, W_DAYS_NO_AID=1.5, W_DELIVERIES=2, MAX_DAYS=30).

SPs en `db/procedures/{scoring_config,prioritization}/`:
- `fn_priority_score(p_family_id) RETURNS jsonb` — lee pesos de `scoring_config`, calcula puntaje, retorna `{ total, breakdown: { factor: valor } }`.
- `sp_scoring_config_set(p_key, p_value, p_user_id, …)` — actualiza un peso, audita, ejecuta `pg_notify('scoring_config_changed', '…')` para que el backend invalide la caché en memoria.

`prioritization.service.ts` (orquestación + caché):
- Listener `pg.Client` suscrito a `LISTEN scoring_config_changed` que invalida la caché.
- Endpoint `PUT /scoring-config` invoca `sp_scoring_config_set`. `GET /scoring-config` lee desde caché o BD.

**Acceptance Criteria**:
- [ ] Tabla seedeada con los pesos iniciales.
- [ ] `calculateScore()` retorna `{ total, breakdown: { factor: valor } }`.
- [ ] `GET /families/:id` y `GET /prioritization/ranking` incluyen `priority_score_breakdown` (HU-08 CA2).
- [ ] Actualizar config invalida caché; siguiente cálculo usa nuevos valores.
- [ ] PUT restringido a ADMIN/COORDINADOR_LOGISTICA.
- [ ] Tests unitarios: scoring con varias composiciones, tope de días sin ayuda, breakdown correcto.

---

### Issue #21 — Endpoints de priorización
**Labels**: `feature`, `algorithm`, `step-8`
**Depends on**: #20

- `GET /prioritization/ranking` — familias ordenadas por puntaje desc, paginado.
- `POST /prioritization/recalculate` — bulk recalcula scores de todas las familias activas. Invalida caché primero.
- `GET /prioritization/next-batch?count=N` — top N elegibles (sin cobertura vigente).

**Acceptance Criteria**:
- [ ] Ranking paginado con filtros (zona, estado) y breakdown incluido.
- [ ] Recalculate solo ADMIN/COORDINADOR_LOGISTICA.
- [ ] Next-batch filtra elegibilidad.
- [ ] Incluye family_code, priority_score, zona, last_delivery_date.

---

## Paso 9: Entregas

### Issue #22 — Delivery + DeliveryDetail (prefijo ENT, estados ES, excepción)
**Labels**: `database`, `deliveries`, `step-9`
**Depends on**: #12, #15

Migración con dos tablas:
- `deliveries` (delivery_code **ENT-2026-NNNNN**, family_id FK, source_warehouse_id FK, plan_item_id FK opcional, delivery_date, delivered_by FK User, received_by_document, coverage_days Int CHECK >= 3, **status enum PROGRAMADA/EN_CURSO/ENTREGADA**, delivery_latitude, delivery_longitude, **exception_reason opcional**, **exception_authorized_by FK User opcional**, client_op_id TEXT UNIQUE).
- `delivery_details` (delivery_id FK, resource_type_id FK, quantity, weight_kg).

SPs base (lógica completa en #23/#24): firmas en `db/procedures/deliveries/`.

**Acceptance Criteria**:
- [ ] Delivery con todas las relaciones y constraints.
- [ ] CHECK coverage_days >= 3 a nivel BD.
- [ ] Código ENT secuencial (RN-07).
- [ ] Status enum en español.
- [ ] `client_op_id` único (para idempotencia offline — #32).

---

### Issue #23 — Elegibilidad + ración + excepción coordinator
**Labels**: `feature`, `deliveries`, `priority: high`, `step-9`
**Depends on**: #20, #22

Servicio de delivery:
- **Elegibilidad**: familia no tiene entrega ENTREGADA cuya cobertura no haya expirado (`delivery_date + coverage_days > today`). Respuesta <2s (RNF-04).
- **Ración mínima**: `num_members * 0.6 * coverage_days` con `coverage_days >= 3` (HU-23).
- **Excepción**: endpoint `POST /deliveries/exception` permite crear entrega anticipada con `exception_reason` obligatorio y `exception_authorized_by` = user coordinador. Solo rol COORDINADOR_LOGISTICA (HU-23 CA5).

**Acceptance Criteria**:
- [ ] `checkEligibility(familyId)` retorna `{ eligible, reason?, last_delivery?, coverage_expires?, days_remaining? }` (HU-23 CA2).
- [ ] Entrega duplicada a familia cubierta retorna 409.
- [ ] Ración calculada correctamente.
- [ ] `coverage_days < 3` rechazado con 400.
- [ ] Excepción solo por COORDINADOR_LOGISTICA, con justificación registrada.
- [ ] Intento bloqueado registrado en `audit_logs`.

---

### Issue #24 — Creación transaccional + entrega por lote + Idempotency-Key
**Labels**: `feature`, `deliveries`, `priority: high`, `step-9`
**Depends on**: #23

`POST /deliveries` (individual) delegado al SP `sp_delivery_create` (transacción interna PL/pgSQL):
1. Verifica elegibilidad.
2. Verifica stock suficiente en bodega.
3. Crea Delivery + DeliveryDetails.
4. Decrementa inventario y `current_weight_kg`.
5. Recalcula priority_score.

Acepta header `Idempotency-Key` (= `client_op_id`). Si ya existe delivery con ese op_id, retorna la misma respuesta sin duplicar.

`POST /deliveries/batch` — procesa top N priorizadas con paquete estándar, salta las ineligibles, asigna bodega más cercana.

`PUT /deliveries/:id/status` para transicionar PROGRAMADA → EN_CURSO → ENTREGADA.

**Acceptance Criteria**:
- [ ] Creación atómica (todo o nada).
- [ ] Stock insuficiente retorna 400 con detalle de faltantes.
- [ ] Priority_score recalculado tras entrega (RN-08).
- [ ] Batch procesa top N con skip de ineligibles.
- [ ] `Idempotency-Key` funciona: segundo POST con mismo key retorna delivery existente, no duplica.
- [ ] Transiciones de estado validadas (no permite retroceder).
- [ ] Lista con filtros (family, warehouse, status, date range).

---

## Paso 10: Planes de distribución

### Issue #25 — Distribution Plans 🆕
**Labels**: `feature`, `deliveries`, `priority: high`, `step-10`
**Depends on**: #21, #24

Modelos:
- `DistributionPlan` (plan_code PLN-2026-NNNNN, created_by FK, **status PROGRAMADA/EN_EJECUCION/COMPLETADA/CANCELADA**, **scope GLOBAL/ZONA/REFUGIO/LOTE**, scope_id opcional, notes, created_at).
- `DistributionPlanItem` (plan_id FK, family_id FK, source_warehouse_id FK, target_coverage_days, **status PENDIENTE/ENTREGADO/SIN_ATENDER**, delivery_id FK opcional).

Endpoints:
- `POST /distribution-plans` — genera plan: toma familias elegibles del scope, las ordena por puntaje, asigna recursos respetando stock y cobertura mínima. Marca items como SIN_ATENDER si no alcanza (HU-21 CA4). Guarda como PROGRAMADA.
- `GET /distribution-plans`, `GET /:id` (con items), `PUT /:id/cancel`.
- `POST /:id/execute` — materializa entregas de items PENDIENTE → transiciona plan a EN_EJECUCION / COMPLETADA.

**Acceptance Criteria**:
- [ ] Plan-code secuencial PLN.
- [ ] Scope filtra familias (GLOBAL/ZONA/REFUGIO/LOTE).
- [ ] Items ordenados por puntaje descendente.
- [ ] Genera SIN_ATENDER + alerta cuando no hay stock suficiente.
- [ ] Cada item asignado garantiza 3 días (RN-01).
- [ ] Solo ADMIN/COORDINADOR_LOGISTICA pueden crear/ejecutar.
- [ ] Execute crea Deliveries con `plan_item_id` referenciado.
- [ ] Tests de integración del flujo completo (plan → execute → inventario decrementado → priority_score recalculado).

---

## Paso 11: Salubridad y traslados

### Issue #26 — Health Vectors con estado
**Labels**: `feature`, `health`, `geo`, `step-11`
**Depends on**: #10

Migración con tabla `health_vectors` (**vector_type enum AGUA_CONTAMINADA/INSECTOS/ROEDORES/OTRO**, risk_level LOW/MEDIUM/HIGH/CRITICAL, **status enum ACTIVO/EN_ATENCION/RESUELTO**, actions_taken, latitude, longitude, zone_id FK opcional, shelter_id FK opcional, reported_date, reported_by FK User). SPs en `db/procedures/health_vectors/`: `fn_health_vectors_create`, `fn_health_vectors_list` (filtros zone/shelter/risk_level/vector_type/status), `fn_health_vectors_find_by_id`, `sp_health_vectors_update`, `sp_health_vector_set_status` (registra cambio + audit). CRUD + `PUT /:id/status`.

**Acceptance Criteria**:
- [ ] Enum vector_type literal del PDF.
- [ ] Enum status con 3 valores (HU-25 CA2).
- [ ] CRUD protegido ADMIN/COORDINADOR_LOGISTICA.
- [ ] `PUT /:id/status` permite actualizar estado + actions_taken (HU-25 CA3).
- [ ] Filtrable por zone, shelter, risk_level, vector_type, status.
- [ ] Auditoría registra cambios de estado (HU-25 CA4).

---

### Issue #27 — Relocations
**Labels**: `feature`, `relocations`, `step-11`
**Depends on**: #11, #12

Migración con tabla `relocations` (family_id FK, origin_shelter_id FK, destination_shelter_id FK, type TEMPORARY/PERMANENT, relocation_date, reason, authorized_by FK User).

SP `sp_relocation_apply(p_relocation JSONB, p_user_id, p_ip, p_user_agent)` — transacción interna PL/pgSQL que:
1. Valida que el destino tenga capacidad (`current_occupancy + family.num_members <= max_capacity`); si no, `SH409`.
2. Inserta `relocations`.
3. Actualiza `families.shelter_id`.
4. Decrementa ocupación del refugio origen, incrementa la del destino.
5. Audita.

**Acceptance Criteria**:
- [ ] Transacción atómica.
- [ ] Rechaza si destino excede capacidad (HU-24 CA3).
- [ ] Queda en historial inmutable (audit_logs).
- [ ] Filtrable por family, shelter, type, date range.

---

## Paso 12: Auditoría inmutable

### Issue #28 — AuditLog + middleware 🆕
**Labels**: `feature`, `audit`, `priority: high`, `step-12`
**Depends on**: #9.1

Migración con tabla `audit_logs` (id, action, module, entity, entity_id, user_id FK, before JSONB, after JSONB, ip_address INET, user_agent TEXT, created_at). En la misma migración: `REVOKE UPDATE, DELETE ON audit_logs FROM <app_role>` (CV-11, RNF-09).

SPs en `db/procedures/_common/` (afectan a TODOS los SPs de mutación del proyecto):
- `sp_audit_insert(p_action, p_module, p_entity, p_entity_id, p_user_id, p_before JSONB, p_after JSONB, p_ip INET, p_user_agent TEXT)` — inserta una fila en `audit_logs`. **Es invocada desde dentro de cada SP de mutación** (no es middleware: la auditoría es parte de la transacción de negocio, garantizando que ninguna mutación quede sin registrar incluso si la transacción se completa parcialmente). Cada SP de mutación previo debe haberse refactorizado para llamarla.

SPs en `db/procedures/audit/`:
- `fn_audit_list(p_filters JSONB, p_limit, p_offset)` — filtros por user_id, module, action, date range (HU-31 CA3). Sólo expuesto a FUNCIONARIO_CONTROL/ADMIN vía `role.middleware`.

**Sin endpoints de mutación**. Sin middleware Node — toda la responsabilidad de auditar está en los SPs.

**Acceptance Criteria**:
- [ ] Tabla audit_logs sin SET/DELETE permitido (usar migration para revocar).
- [ ] Middleware registra todas las mutaciones (POST/PUT/DELETE).
- [ ] before/after en JSON con diff utilizable.
- [ ] IP y user-agent capturados.
- [ ] GET protegido a 2 roles únicamente.
- [ ] Entradas inmutables verificadas: test intentando UPDATE manual debe fallar.

---

## Paso 13: Mapa y reportes con export

### Issue #29 — Mapa + endpoint "zonas sin entregas"
**Labels**: `feature`, `geo`, `map`, `step-13`
**Depends on**: #11, #15, #12, #26

Endpoints:
- `GET /map/shelters` — coords, ocupación, capacidad.
- `GET /map/warehouses` — coords, % stock.
- `GET /map/families` — coords + estado + priority_score (sin datos personales).
- `GET /map/vectors` — coords + risk_level + status.
- `GET /map/zone/:id` — todas las entidades geolocalizadas de la zona.
- `GET /map/recent-deliveries` — últimos 7 días.
- `GET /map/zones-without-deliveries` — zonas con cero entregas (HU-30 CA1).

**Acceptance Criteria**:
- [ ] Formato GeoJSON-compatible.
- [ ] Family endpoint excluye nombres y documentos.
- [ ] Zone endpoint agrega todas las entidades.
- [ ] Recent deliveries filtradas a 7 días.
- [ ] Zones-without-deliveries incluye población y # familias registradas (HU-30 CA5).
- [ ] Accesible a todos los roles autenticados.

---

### Issue #30 — Reportes base
**Labels**: `feature`, `reports`, `step-13`
**Depends on**: #16, #24

- `GET /reports/coverage` — % con cobertura vigente vs total, por zona.
- `GET /reports/inventory` — stock por bodega y categoría.
- `GET /reports/unattended-families` — sin entrega o cobertura expirada, ordenadas por priority_score desc (HU-28 CA3).

**Acceptance Criteria**:
- [ ] Coverage incluye cubiertos/no cubiertos/% por zona.
- [ ] Inventario agrega por categoría y por bodega.
- [ ] Unattended con filtros de zona y fecha.
- [ ] Formato consistente entre reportes.

---

### Issue #31 — Reportes avanzados + export PDF/Excel + dashboard + trazabilidad 🆕
**Labels**: `feature`, `reports`, `priority: high`, `step-13`
**Depends on**: #19, #24, #30

Endpoints:
- `GET /reports/donations-by-type` — agrupado por tipo de donante.
- `GET /reports/deliveries-by-zone` — entregas y peso total por zona.
- `GET /reports/dashboard` — métricas clave en un solo response.
- `GET /reports/traceability` — rastrea recurso desde donante → bodega → entrega → familia (HU-29 CA1).

**Export**: cada endpoint acepta `?format=json|pdf|xlsx`. Usar `pdfkit` y `exceljs` en backend. Export incluye filtros aplicados.

**Acceptance Criteria**:
- [ ] Donations agrupadas por donor type con subtotales.
- [ ] Deliveries agregadas por zona con count y weight.
- [ ] Dashboard optimizado (evita N+1).
- [ ] Todos los reports accesibles a ADMIN/COORDINADOR_LOGISTICA/FUNCIONARIO_CONTROL; operador ve su propio dashboard.
- [ ] `?format=pdf` devuelve un PDF descargable; `?format=xlsx` un .xlsx (HU-28 CA4, HU-29 CA5).
- [ ] Trazabilidad: dado un donation_id o resource_type, lista toda la cadena hasta la familia beneficiaria.
- [ ] Filtros por fecha, donor type, zona en trazabilidad (HU-29 CA3).

---

## Paso 14: PWA + offline + sincronización

### Issue #32 — PWA + Service Worker + IndexedDB + /sync endpoint 🆕
**Labels**: `feature`, `pwa`, `offline`, `priority: high`, `step-14`
**Depends on**: #12, #22, #24

**Frontend**:
- `vite-plugin-pwa` configurado, manifest.webmanifest, iconos 192/512/maskable.
- Service Worker con estrategias: NetworkFirst (HTML, API GET idempotentes), StaleWhileRevalidate (assets).
- `src/lib/offlineQueue.ts` con Dexie — store `pending_ops` (entity, payload, client_op_id, created_at, attempts, last_error).
- `src/lib/syncManager.ts` — flush FIFO con retries exponenciales.
- `src/context/SyncContext.tsx` — estado `{ status, pendingCount, lastSyncAt }`.
- `src/components/layout/ConnectionBadge.tsx` — pill visible en navbar.
- Formularios de censo (HU-04) y entrega (HU-22) funcionan offline: generan `client_op_id`, guardan en IndexedDB, muestran toast "guardado localmente".

**Backend**:
- `POST /sync` — acepta batch `{ ops: [{ client_op_id, method, url, payload }] }` y los procesa secuencialmente con deduplicación por `client_op_id` sobre tablas que lo soporten (Deliveries, Families, Persons, Relocations).
- `GET /sync/status` — última marca aplicada por cliente.
- Middleware `idempotency.middleware.ts` — al ver `Idempotency-Key` header en `POST /deliveries` o `POST /families`, busca por ese op_id; si existe, retorna el resultado anterior sin duplicar.

**Acceptance Criteria**:
- [ ] App instala como PWA (Chrome "Add to Home Screen").
- [ ] Offline shell funciona (abrir app sin red muestra cache).
- [ ] Desconectar red → registrar familia → reconectar → sincroniza y aparece en listado.
- [ ] Mismo flujo para entregas.
- [ ] `Idempotency-Key` previene duplicados si se reintenta.
- [ ] ConnectionBadge refleja estado y contador de pendientes.
- [ ] Tests E2E con jsdom o Playwright (opcional).
- [ ] Capacidad: IndexedDB soporta al menos 200 ops pendientes sin degradación.

---

## Paso 15: Tests y datos de demo

### Issue #33 — Tests unitarios + integración + seeds de demo
**Labels**: `testing`, `step-15`
**Depends on**: #9.1, #20, #24, #25, #28, #32

**Tests unitarios** (`server/tests/unit/`):
- `prioritization.test.ts` — cálculo con varias composiciones, tope de días, breakdown, lectura desde scoring_config.
- `delivery.test.ts` — elegibilidad, ración, coverage < 3.
- `inventory.test.ts` — capacidad, ajustes con motivo.
- `auth.test.ts` — lockout tras 5 fallos, usuario desactivado, password_must_change.

**Tests de integración** (`server/tests/integration/`):
- `auth.test.ts` — register, login, /me, /change-password, lockout, role protection.
- `delivery-flow.test.ts` — donation → inventory → plan → execute → deliveries → inventory decrementado → priority recalculado → intento duplicado bloqueado → excepción autorizada.
- `audit.test.ts` — mutación crea audit entry; intento UPDATE manual falla.
- `sync.test.ts` — batch de ops con Idempotency-Key no duplica.

**Seed de demo** (`server/db/seeds/*.sql` ampliados):
- Admin + usuarios por cada rol.
- Zonas y refugios reales de Montería.
- Bodegas sumando 20.000 kg.
- Catálogo completo de recursos.
- 30 familias variadas con consentimiento.
- 5 donantes y donaciones representativas.
- Plan de distribución ejemplo con algunas entregas ejecutadas.
- scoring_config con pesos por defecto.
- alert_thresholds por recurso.

**Acceptance Criteria**:
- [ ] `npm test` desde raíz ejecuta todos los tests.
- [ ] Coverage reportado por Jest.
- [ ] Seed crea entorno de demo reproducible.
- [ ] Tests cubren CV-01 a CV-14 del PDF.
- [ ] Integration tests pasan con BD de test aislada.

---

## Dependency Graph

```
#1 → #2 → #3 ┬→ #4 → #5 → #6
             │
             └→ #7 → #8 → #9 → #9.1 → #9.2  ← migración a pg + MVC + SPs (cross-cutting fundacional)
                                       │
                                       ├→ #10 → #11
                                       │    │
                                       │    └→ #12 → #13 → #14
                                       │         │
                                       │         └→ #20 → #21
                                       │              │
                                       │              ├→ #22 → #23 → #24 → #25
                                       │              │
                                       ├→ #15 → #16 → #17
                                       │    │    │
                                       │    │    └→ #19
                                       │    │
                                       │    └→ #18
                                       │
                                       ├→ #26 (depends on #10)
                                       │
                                       ├→ #27 (depends on #11, #12)
                                       │
                                       ├→ #28 (sp_audit_insert + REVOKE — cross-cutting; cada SP de mutación lo invoca)
                                       │
                                       ├→ #29 (#11, #15, #12, #26)
                                       │
                                       ├→ #30 → #31
                                       │
                                       ├→ #32 (#12, #22, #24)
                                       │
                                       └→ #33 (tests — al final)
```

---

## Renumeración final

| # | Título | Estado |
|---|--------|--------|
| 1 | Scaffolding y dependencias | ✅ |
| 2 | Env y git config | ✅ |
| 3 | Prisma init y config | ✅ |
| 4 | Express app.ts | ✅ |
| 5 | Server entry index.ts | ✅ |
| 6 | Utils + error handler | ✅ |
| 7 | User model + migración | ✅ |
| 8 | Auth service/routes | ✅ |
| 9 | Auth + role middlewares + seed | ✅ |
| 9.1 | Adaptación auth a requerimientos finales | 🆕 |
| 9.2 | Migración a `pg` + MVC + Stored Procedures | 🆕 |
| 10 | Zonas + seed Montería (sobre nuevo patrón) | evolución |
| 11 | Refugios + alerta 90% | evolución |
| 12 | Familias + PrivacyConsent | evolución |
| 13 | Personas | evolución |
| 14 | Sync composición ↔ puntaje | evolución |
| 15 | Bodegas (85%/100%) | evolución |
| 16 | Tipos recurso + inventario + ajustes | evolución |
| 17 | Alertas configurables + nearest | evolución |
| 18 | Donantes (nuevo enum, contact) | evolución |
| 19 | Donaciones transaccional | evolución |
| 20 | ScoringConfig + priorización | 🆕 |
| 21 | Endpoints priorización | evolución |
| 22 | Delivery (ENT, estados ES, excepción) | evolución |
| 23 | Elegibilidad + ración + excepción | evolución |
| 24 | Creación + batch + Idempotency-Key | evolución |
| 25 | Planes de distribución | 🆕 |
| 26 | Vectores con estado | evolución |
| 27 | Traslados | evolución |
| 28 | AuditLog + middleware | 🆕 |
| 29 | Mapa + zonas sin entregas | evolución |
| 30 | Reportes base | evolución |
| 31 | Reportes avanzados + export + trazabilidad | 🆕 |
| 32 | PWA + offline + sync | 🆕 |
| 33 | Tests + seeds de demo | evolución |

---

## Trazabilidad con el PDF de requerimientos

### RF → Issue

| RF | Descripción breve | Issue(s) |
|----|-------------------|----------|
| RF-01 | Registrar familias con ubicación | #12 |
| RF-02 | Registrar personas con condición especial | #13 |
| RF-03 | Código único FAM-2026-NNNNN | #12 |
| RF-04 | Puntaje de prioridad | #20, #21 |
| RF-05 | Actualizar familia | #12, #14 |
| RF-06 | Consultar y buscar familias | #12 |
| RF-07 | Verificar cobertura vigente | #23 |
| RF-08 | Registrar zonas | #10 |
| RF-09 | Registrar refugios | #11 |
| RF-10 | Registrar bodegas | #15 |
| RF-11 | Bodega más cercana | #17 |
| RF-12 | Mapa con familias/refugios/bodegas/entregas | #29 |
| RF-13 | Tipos de recurso | #16 |
| RF-14 | Consultar inventario por bodega | #16 |
| RF-15 | Alertas de inventario bajo | #17 |
| RF-16 | Ajuste manual de inventario | #16 |
| RF-17 | Resumen general de inventario | #16 |
| RF-18 | Registrar donantes | #18 |
| RF-19 | Registrar donación | #19 |
| RF-20 | Desglose de recursos de donación | #19 |
| RF-21 | Historial de donaciones por donante | #19 |
| RF-22 | Plan de distribución priorizado | #25 |
| RF-23 | Entrega por lote | #24 |
| RF-24 | Registrar entrega | #24 |
| RF-25 | Validar cobertura vigente | #23 |
| RF-26 | Cobertura mínima 3 días | #23 |
| RF-27 | Descuento automático de inventario | #24 |
| RF-28 | Registrar ubicación de entrega | #22, #24 |
| RF-29 | Estados de entrega | #22, #24 |
| RF-30 | Traslado de familias | #27 |
| RF-31 | Registrar vectores sanitarios | #26 |
| RF-32 | Visualizar vectores en mapa | #29 |
| RF-33 | Reporte de cobertura | #30 |
| RF-34 | Reporte de trazabilidad | #31 |
| RF-35 | Zonas sin entregas | #29, #31 |
| RF-36 | Familias no atendidas | #30 |
| RF-37 | Donaciones por tipo | #31 |
| RF-38 | Entregas por zona | #31 |
| RF-39 | Dashboard con indicadores | #31 |
| RF-40 | Historial de auditoría inalterable | #28 |
| RF-41 | Crear/modificar/desactivar usuarios | #9.1 |
| RF-42 | Credenciales por usuario | #9.1 |
| RF-43 | Funciones distintas por rol | #9.1 (backend) + frontend RBAC |
| RF-44 | Cambiar contraseña | #9 / #9.1 |

### HU → Issue

| HU | Título | Issue |
|----|--------|-------|
| HU-01 | Gestionar usuarios | #9.1 |
| HU-02 | Iniciar sesión según rol | #9.1 |
| HU-03 | Cambiar contraseña propia | #9.1 |
| HU-04 | Registrar familia en terreno (offline) | #12, #32 |
| HU-05 | Registrar personas en familia | #13 |
| HU-06 | Consultar y buscar familias | #12 |
| HU-07 | Actualizar familia | #12, #14 |
| HU-08 | Calcular y visualizar puntaje | #20 |
| HU-09 | Registrar zonas | #10 |
| HU-10 | Registrar refugios | #11 |
| HU-11 | Registrar bodegas (85%/100%) | #15 |
| HU-12 | Bodega más cercana | #17 |
| HU-13 | Mapa con capas | #29 |
| HU-14 | Registrar tipos de recurso | #16 |
| HU-15 | Consultar inventario | #16 |
| HU-16 | Alertas configurables | #17 |
| HU-17 | Ajustar inventario con motivo | #16 |
| HU-18 | Registrar donante | #18 |
| HU-19 | Registrar donación | #19 |
| HU-20 | Historial de donaciones | #19 |
| HU-21 | Plan de distribución | #25 |
| HU-22 | Registrar entrega individual (offline) | #24, #32 |
| HU-23 | Prevenir entrega duplicada | #23 |
| HU-24 | Traslado entre refugios | #27 |
| HU-25 | Registrar foco sanitario | #26 |
| HU-26 | Focos en mapa | #29 |
| HU-27 | Panel de indicadores | #31 |
| HU-28 | Reporte de cobertura (con export) | #30, #31 |
| HU-29 | Reporte de trazabilidad (con export) | #31 |
| HU-30 | Zonas sin entregas | #29, #31 |
| HU-31 | Historial de auditoría | #28 |

### RN → Issue → SP que la enforza

| RN | Descripción | Issue(s) | SP/FN |
|----|-------------|----------|-------|
| RN-01 | Cobertura mínima 3 días | #22, #23, #24 | CHECK `coverage_days >= 3` + `sp_delivery_create` |
| RN-02 | Prevención de duplicidad | #23 | `fn_delivery_check_eligibility`, excepción `sp_delivery_create_exception` |
| RN-03 | Capacidad de bodega | #15, #16, #19 | CHECK + `sp_donations_create`, `sp_inventory_adjust` |
| RN-04 | Priorización configurable | #20 | `fn_priority_score`, `scoring_config` |
| RN-05 | Descuento automático | #24 | `sp_delivery_create` (transacción interna) |
| RN-06 | Trazabilidad completa | #31 | `fn_report_traceability` (recursive CTE) |
| RN-07 | Códigos secuenciales | #9.2 (helper), #9.1 (ENT prefix), #12 (FAM), #19 (DON), #25 (PLN) | `fn_next_code(p_prefix)` |
| RN-08 | Recálculo de prioridad | #14, #20, #24 | `sp_persons_upsert_and_recalc`, `sp_delivery_create` |
| RN-09 | Aviso de privacidad | #12 | `sp_families_create_with_consent` (lanza `SH422` si no llega flag) |
| RN-10 | Ubicación requerida | #11, #15 | `NOT NULL` en DDL de `shelters` y `warehouses` |

### RNF → Issue

| RNF | Descripción | Issue(s) |
|-----|-------------|----------|
| RNF-01 | Facilidad de uso (mobile-first, <1h de curva) | FRONTEND-PLAN §4, cross-cutting |
| RNF-02 | Funcionamiento sin internet | #32 |
| RNF-03 | Capacidad 50k personas | #33 (perf tests) |
| RNF-04 | Velocidad <2s | #12, #23 |
| RNF-05 | Escalabilidad | #15 (indexes), #33 |
| RNF-06 | Protección de datos personales | #12 (PrivacyConsent) |
| RNF-07 | Seguridad de acceso (cifrado) | #9.1 (bcrypt + HTTPS) |
| RNF-08 | Conexiones lentas | #32 |
| RNF-09 | Registro de acciones inalterable | #28 |

### CV → Issue

| CV | Descripción | Issue(s) |
|----|-------------|----------|
| CV-01 | Registrar familias con datos | #12, #13 |
| CV-02 | Código único consecutivo | #12 |
| CV-03 | Puntaje calculado correctamente | #20, #33 |
| CV-04 | No entrega si cobertura vigente | #23 |
| CV-05 | Inventario se reduce en entregas | #24 |
| CV-06 | No exceder capacidad bodega | #15, #19 |
| CV-07 | Reportes muestran trazabilidad | #31 |
| CV-08 | Funciona sin internet y sincroniza | #32 |
| CV-09 | Consultas de entrega <2s | #23 |
| CV-10 | Cada rol ve sus funciones | #9.1 + frontend RBAC |
| CV-11 | Registro de acciones no modificable | #28 |
| CV-12 | Soporta 50k personas | #33 |
| CV-13 | Zonas sin entregas identificables | #29 |
| CV-14 | Vectores visualizables en mapa | #29 |

---

## Resumen por paso

| Paso | Issues | Descripción |
|------|--------|-------------|
| 1 | #1, #2, #3 | Inicialización |
| 2 | #4, #5, #6 | Infraestructura base |
| 3 | #7, #8, #9 | Autenticación v1 |
| 3.1 | #9.1 | Adaptación auth a requerimientos finales |
| 3.2 | #9.2 | Migración a `pg` + MVC + Stored Procedures (cambio fundacional) |
| 4 | #10, #11 | Zonas y refugios |
| 5 | #12, #13, #14 | Familias + privacy + personas |
| 6 | #15, #16, #17 | Bodegas e inventario |
| 7 | #18, #19 | Donantes y donaciones |
| 8 | #20, #21 | ScoringConfig + priorización |
| 9 | #22, #23, #24 | Entregas |
| 10 | #25 | Planes de distribución |
| 11 | #26, #27 | Salubridad y traslados |
| 12 | #28 | Auditoría |
| 13 | #29, #30, #31 | Mapa y reportes |
| 14 | #32 | PWA + offline |
| 15 | #33 | Tests + demo |

---

## Labels Reference

| Label | Significado |
|-------|-------------|
| `priority: critical` | Bloquea múltiples issues |
| `priority: high` | Lógica core del negocio |
| `setup` | Setup y configuración |
| `infrastructure` | Arquitectura base |
| `database` | Schema y migraciones |
| `migration` | Cambio de schema en issue posterior |
| `auth` | Autenticación y autorización |
| `middleware` | Middlewares Express |
| `feature` | Nueva funcionalidad |
| `census` | Registro poblacional |
| `inventory` | Gestión de bodegas |
| `donations` | Donantes y donaciones |
| `deliveries` | Distribución |
| `algorithm` | Cálculos de puntaje |
| `health` | Vectores sanitarios |
| `relocations` | Traslados |
| `geo` | Geolocalización |
| `map` | Visualización en mapa |
| `reports` | Reportes y analítica |
| `audit` | Auditoría inmutable |
| `pwa` | Progressive Web App |
| `offline` | Funcionalidad offline |
| `testing` | Tests y datos |
| `step-N` | Paso N del plan |
