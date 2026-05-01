# SIGAH - Sistema de Gestión y Distribución de Ayudas Humanitarias

## Context

En 2026, Montería registró una de las inundaciones más fuertes en la zona de la margen izquierda, dejando a ~50.000 personas afectadas (~12.000 familias, ~10.000 desplazados en refugios) sin acceso a alimentos básicos, techo y elementos de uso diario. Se estableció un centro de distribución con capacidad total de **20.000 kg** y recursos provenientes de alcaldía, gobernación, empresas privadas y ciudadanos.

El sistema debe:
- Registrar de forma unificada a las familias afectadas y sus miembros con datos veraces (incluyendo consentimiento Ley 1581/2012).
- Priorizar a las familias más vulnerables (niños <5, adultos >65, gestantes, personas con discapacidad, riesgo de la zona, días sin ayuda) con una fórmula configurable.
- Garantizar cobertura mínima de **3 días** por entrega (0,6 kg/persona/día de alimentos) y evitar duplicidad.
- Mantener trazabilidad completa desde el donante hasta la familia beneficiaria.
- Geolocalizar familias, refugios, bodegas y puntos de entrega para optimizar la logística.
- Monitorear focos sanitarios (vectores) por zona/refugio.
- Funcionar **mobile-first** (90% del trabajo de campo se hace desde smartphone) y **offline** — datos se guardan localmente y se sincronizan al recuperar conexión.
- Registrar un historial de auditoría inalterable de todas las acciones.

**Stack**: Node.js + Express 5 | TypeScript strict | PostgreSQL + `pg` (node-postgres) + Stored Procedures (PL/pgSQL) | JWT | React 19 + Vite 8 + TypeScript | PWA (Service Worker + IndexedDB) | Monolito

**Arquitectura**: Monolítica — Express sirve la API REST (`/api/v1`) y el frontend React compilado (`client/dist/`). En desarrollo, Vite proxy-a peticiones `/api` a Express (puerto 3000). En producción ambos se sirven desde el mismo origen.

Backend en **MVC + Service layer**: `models/` envuelven llamadas tipadas a stored procedures (`fn_*`, `sp_*`); `services/` orquestan; `controllers/` transportan HTTP; `views/` serializan respuestas. **Toda la lógica de negocio (RN-01..RN-10, recálculos de prioridad, descuento de inventario, lockout de login, atomicidad de donaciones/entregas/traslados, auditoría) reside en stored procedures de PostgreSQL.** El backend Node es una capa fina de transporte: no abre transacciones, no replica reglas de negocio.

---

## Database Schema (22 tablas)

### Seguridad y auditoría
- **users** — Usuarios del sistema (email único, password_hash, name, role, is_active, failed_login_attempts, locked_until, last_login_at, password_must_change, created_at, updated_at)
- **audit_logs** — Historial inmutable (action, module, entity, entity_id, user_id, before JSON, after JSON, ip_address, user_agent, created_at). UPDATE/DELETE prohibidos a nivel de BD (permisos SQL).
- **scoring_config** — Pesos y parámetros configurables de la fórmula de priorización (key, value Float, updated_by FK users, updated_at). Editable por ADMIN / LOGISTICS_COORDINATOR.
- **alert_thresholds** — Umbral de stock bajo configurable por recurso (resource_type_id FK, min_quantity, updated_by, updated_at).

### Geografía y refugios
- **zones** — Zonas geográficas afectadas (name, risk_level: LOW/MEDIUM/HIGH/CRITICAL, latitude, longitude, estimated_population)
- **shelters** — Refugios temporales (name, address, zone_id FK, max_capacity, current_occupancy, type, latitude NOT NULL, longitude NOT NULL)

### Censo poblacional
- **families** — Unidades familiares (family_code, head_document, zone_id FK, shelter_id FK opcional, num_members, num_children_under_5, num_adults_over_65, num_pregnant, num_disabled, priority_score Float, priority_score_breakdown JSON, status: ACTIVE/IN_SHELTER/EVACUATED, latitude opcional, longitude opcional, reference_address opcional)
- **persons** — Miembros individuales (family_id FK, name, document único, birth_date, gender, relationship: SPOUSE/CHILD/PARENT/SIBLING/OTHER, special_conditions[], requires_medication)
- **privacy_consents** — Aceptaciones del aviso de privacidad (family_id FK, accepted_at, accepted_by_user_id FK users, law_version = "Ley 1581/2012", ip_address)

### Recursos e inventario
- **warehouses** — Bodegas físicas (name, address, latitude NOT NULL, longitude NOT NULL, max_capacity_kg, current_weight_kg, status: ACTIVE/INACTIVE, zone_id FK)
- **resource_types** — Catálogo de tipos de ayuda (name, category: FOOD/BLANKET/MATTRESS/HYGIENE/MEDICATION, unit_of_measure, unit_weight_kg, is_active). Unique (name, category).
- **inventory** — Stock actual por bodega y recurso (warehouse_id FK, resource_type_id FK, available_quantity, total_weight_kg, batch, expiration_date). Unique (warehouse_id, resource_type_id, batch).
- **inventory_adjustments** — Historial de ajustes manuales (inventory_id FK, delta Int, reason: SHRINKAGE/DAMAGE/RETURN/CORRECTION, reason_note, user_id FK, created_at)

### Donaciones
- **donors** — Registro de donantes (name, type: INDIVIDUAL/COMPANY/CITY_HALL/GOVERNOR_OFFICE/ORGANIZATION, contact, tax_id opcional). Unique (name, type).
- **donations** — Eventos de donación (donation_code, donor_id FK, destination_warehouse_id FK, donation_type: IN_KIND/MONETARY/MIXED, monetary_amount, date)
- **donation_details** — Recursos de donaciones en especie (donation_id FK, resource_type_id FK, quantity, weight_kg)

### Distribución
- **distribution_plans** — Plan priorizado (plan_code `PLN-2026-NNNNN`, created_by FK users, status: SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED, scope: GLOBAL/ZONE/SHELTER/BATCH, scope_id opcional, notes, created_at)
- **distribution_plan_items** — Asignaciones del plan (plan_id FK, family_id FK, source_warehouse_id FK, target_coverage_days, status: PENDING/DELIVERED/UNATTENDED, delivery_id FK nullable)
- **deliveries** — Entregas a familias (delivery_code `DEL-2026-NNNNN`, family_id FK, source_warehouse_id FK, plan_item_id FK opcional, delivery_date, delivered_by FK, received_by_document, coverage_days CHECK >= 3, status: SCHEDULED/IN_PROGRESS/DELIVERED, delivery_latitude, delivery_longitude, exception_reason opcional, exception_authorized_by FK users opcional, client_op_id único opcional)
- **delivery_details** — Ítems entregados (delivery_id FK, resource_type_id FK, quantity, weight_kg)

### Operaciones
- **health_vectors** — Vectores sanitarios (vector_type: CONTAMINATED_WATER/INSECTS/RODENTS/OTHER, risk_level: LOW/MEDIUM/HIGH/CRITICAL, status: ACTIVE/IN_PROGRESS/RESOLVED, actions_taken, latitude, longitude, zone_id FK opcional, shelter_id FK opcional, reported_date, reported_by FK)
- **relocations** — Traslados de familia (family_id FK, origin_shelter_id FK, destination_shelter_id FK, type: TEMPORARY/PERMANENT, relocation_date, reason, authorized_by FK)

---

## Stored Procedures por módulo (anexo)

> Lista de referencia. Cada `*.sql` vive en `server/db/procedures/<módulo>/`. Convenciones: `fn_*` retorna fila/conjunto; `sp_*` orquesta transacciones complejas. Nombres exactos pueden variar al implementar.

### `_common/`
- `fn_next_code(p_prefix TEXT)` — genera `<PREFIX>-2026-NNNNN` con `SELECT FOR UPDATE` sobre tabla contador.
- `sp_audit_insert(p_action, p_module, p_entity, p_entity_id, p_user_id, p_before JSONB, p_after JSONB, p_ip INET, p_user_agent TEXT)`.

### `users/`
`fn_users_find_by_email`, `fn_users_find_by_id`, `fn_users_create`, `fn_users_list`, `sp_auth_login` (lockout + last_login_at), `sp_users_change_password`, `sp_users_reset_password`, `sp_users_set_active`.

### `zones/`
`fn_zones_create`, `fn_zones_list`, `fn_zones_find_by_id`, `fn_zones_update`, `sp_zones_delete`, `fn_zones_families`, `fn_zones_shelters`, `fn_zones_warehouses`.

### `shelters/`
`fn_shelters_create`, `fn_shelters_list`, `fn_shelters_find_by_id`, `sp_shelters_set_occupancy` (valida `<= max_capacity`).

### `families/` + `persons/` + `privacy_consents/`
`sp_families_create_with_consent` (atómico: family + consent + código FAM), `fn_families_search` (pg_trgm), `fn_families_get_eligibility`, `fn_families_list`, `fn_families_find_by_id`, `sp_families_update`, `sp_persons_upsert_and_recalc` (composición + `fn_priority_score`), `sp_persons_delete` (bloqueado si es el último miembro).

### `warehouses/` + `inventory/` + `resource_types/` + `alert_thresholds/`
`fn_warehouses_create`, `fn_warehouses_list`, `fn_warehouses_nearest` (Haversine en SQL), `fn_resource_types_*`, `fn_inventory_list`, `fn_inventory_summary`, `sp_inventory_adjust` (RN-03 + audit), `fn_inventory_alerts`, `fn_alert_thresholds_*`.

### `donors/` + `donations/`
`fn_donors_*`, `sp_donations_create` (transacción Donation + Details + Inventory + Warehouse, RN-03), `fn_donations_by_donor`.

### `scoring_config/` + `prioritization/`
`fn_priority_score(p_family_id)` (retorna `total + breakdown JSONB`), `sp_scoring_config_set` (notifica invalidar caché), `fn_prioritization_ranking`, `fn_prioritization_next_batch`, `sp_prioritization_recalculate_all`.

### `deliveries/`
`fn_delivery_check_eligibility`, `sp_delivery_create` (atómico: stock + decremento + recalc — RN-01/02/05/08, soporta `Idempotency-Key`/`client_op_id`), `sp_delivery_create_exception`, `sp_delivery_set_status`, `sp_delivery_create_batch`.

### `distribution_plans/`
`sp_distribution_plan_generate(p_scope, p_scope_id)`, `sp_distribution_plan_execute`, `sp_distribution_plan_cancel`, `fn_distribution_plans_list`.

### `health_vectors/`
`fn_health_vectors_*`, `sp_health_vector_set_status`.

### `relocations/`
`sp_relocation_apply` (atómico: ocupación origen + destino + family.shelter_id, RN — HU-24).

### `audit/`
`fn_audit_list` (filtros usuario/módulo/fecha; restringido a FUNCIONARIO_CONTROL/ADMIN). Sin SP de mutación: las inserciones llegan vía `sp_audit_insert` desde otros SPs.

### `map/` + `reports/`
`fn_map_shelters`, `fn_map_warehouses`, `fn_map_families` (sin datos sensibles), `fn_map_vectors`, `fn_map_zone_detail`, `fn_map_recent_deliveries`, `fn_map_zones_without_deliveries`, `fn_report_coverage`, `fn_report_inventory`, `fn_report_donations_by_type`, `fn_report_deliveries_by_zone`, `fn_report_unattended_families`, `fn_report_traceability` (recursive CTE donante→bodega→entrega→familia), `fn_dashboard_metrics`.

### `sync/`
`sp_sync_apply_op` (dedupe por `client_op_id`), `fn_sync_status`.

---

## API Modules (prefijo `/api/v1`) — 18 módulos

### 1. Auth (`/auth`)
- POST `/login` (público, con lockout tras 5 intentos), POST `/register` (ADMIN)
- GET `/me`, PUT `/change-password`
- POST `/reset-password/:userId` (ADMIN asigna contraseña temporal)
- PUT `/users/:id` (activar/desactivar — RF-41), GET `/users` (ADMIN)
- JWT 8h. Payload: `{ id, email, role, name }`. Si `password_must_change=true`, el cliente obliga al flujo de cambio.

### 2. Families (`/families`)
- CRUD + GET `/:id/persons` + GET `/:id/deliveries` + GET `/:id/eligibility`
- POST exige `privacy_consent_accepted=true` (RN-09); persiste en `privacy_consents` en la misma transacción.
- GET `/search?q=X` unificada por `family_code|head_document|reference_address` con respuesta <2s (RNF-04).

### 3. Persons (`/persons`)
- CRUD + GET `/search?document=X`
- Cambios en composición recalculan `priority_score` automáticamente (RN-08).

### 4. Zones (`/zones`)
- CRUD + GET `/:id/families` + GET `/:id/shelters` + GET `/:id/warehouses`

### 5. Shelters (`/shelters`)
- CRUD + PUT `/:id/occupancy` (valida max_capacity)

### 6. Warehouses (`/warehouses`)
- CRUD + GET `/:id/inventory` + GET `/nearest?lat=X&lng=Y`
- Alerta visible al 85% de capacidad; rechaza entradas que superen 100% (HU-11 CA3-4).

### 7. Inventory (`/resource-types`, `/inventory`, `/alert-thresholds`)
- CRUD `/resource-types` con `is_active`
- GET `/inventory?warehouse_id=X` + GET `/summary` + GET `/alerts`
- PUT `/inventory/:id/adjustment` exige `reason` enum + `reason_note`; rechaza si resultado < 0; queda en `inventory_adjustments` y `audit_logs`.
- GET/PUT `/alert-thresholds` por recurso (HU-16 CA2).

### 8. Donors and Donations (`/donors`, `/donations`)
- CRUD donors con nuevo enum y `contact` requerido; unique (name, type).
- POST donations (si es IN_KIND/MIXED, delega en `sp_donations_create` que ejecuta la transacción interna y actualiza inventario de bodega destino).
- GET `/donors/:id/donations` (historial por donante — HU-20).

### 9. Deliveries (`/deliveries`)
- POST crear entrega (valida elegibilidad, stock, cobertura mínima, decrementa inventario en transacción). Acepta header `Idempotency-Key` para sincronización offline.
- POST `/batch` — entrega directa a las top N familias prioritarias (independiente del plan).
- POST `/exception` — entrega anticipada (solo LOGISTICS_COORDINATOR, con justificación — HU-23 CA5).
- GET lista + GET `/:id` + PUT `/:id/status` (SCHEDULED → IN_PROGRESS → DELIVERED).

### 10. Distribution Plans (`/distribution-plans`) — HU-21
- POST `/` — genera plan priorizado para scope (GLOBAL/ZONE/SHELTER/BATCH). Incluye familias elegibles, las ordena por puntaje, asigna recursos respetando stock y cobertura mínima, marca sin atender si hay insuficiencia. Guarda como SCHEDULED.
- GET lista + GET `/:id` (con items).
- POST `/:id/execute` — materializa entregas desde el plan.
- PUT `/:id/cancel`.

### 11. Prioritization (`/prioritization`)
- GET `/ranking` + POST `/recalculate` + GET `/next-batch?count=N`
- Lee pesos desde `scoring_config`; respuesta incluye `priority_score_breakdown` por factor (HU-08 CA2).

### 12. Scoring Config (`/scoring-config`) — HU-08 CA5
- GET (autenticado) + PUT (ADMIN / LOGISTICS_COORDINATOR)
- Al actualizar, invalida caché del servicio de priorización.

### 13. Reports (`/reports`)
- GET `/coverage`, `/inventory`, `/donations-by-type`, `/deliveries-by-zone`, `/zones-without-deliveries`, `/unattended-families`, `/traceability`, `/dashboard`
- Cada endpoint acepta `?format=json|pdf|xlsx` (HU-28 CA4, HU-29 CA5).
- `/traceability` (HU-29): rastrea recurso desde donante → bodega → entrega → familia.

### 14. Health Vectors (`/health/vectors`)
- CRUD + PUT `/:id/status` (ACTIVE/IN_PROGRESS/RESOLVED — HU-25 CA3)
- Filtrable por zona, refugio, risk_level, vector_type, status.

### 15. Relocations (`/relocations`)
- POST crea traslado (actualiza family.shelter_id, ajusta ocupación origen y destino, valida max_capacity destino — HU-24 CA3).
- GET lista con filtros.

### 16. Map (`/map`)
- GET `/shelters`, `/warehouses`, `/families`, `/vectors`, `/zone/:id`, `/recent-deliveries`, `/zones-without-deliveries`
- Family endpoint excluye datos sensibles (solo coordenadas, estado, prioridad).

### 17. Audit Log (`/audit`) — RF-40, RNF-09
- GET lista filtrable por usuario, módulo, rango de fechas. Solo accesible a CONTROL_OFFICER / ADMIN.
- Sin endpoints de mutación. Escritura únicamente por el middleware interno.

### 18. Sync (`/sync`) — Offline support
- POST `/sync` — batch de mutaciones offline con deduplicación por `client_op_id`.
- GET `/sync/status` — última marca de sincronización por cliente.

---

## Prioritization Algorithm

Fórmula base (pesos provienen de `scoring_config`):
```
score = (W_MEMBERS * num_members)
      + (W_CHILDREN_5 * num_children_under_5)
      + (W_ADULTS_65 * num_adults_over_65)
      + (W_PREGNANT * num_pregnant)
      + (W_DISABLED * num_disabled)
      + (W_ZONE_RISK * zone_risk_factor)     // LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4
      + (W_DAYS_NO_AID * days_without_aid)   // capado en MAX_DAYS
      - (W_DELIVERIES * deliveries_received)
```

**Pesos iniciales (seed de `scoring_config`)**: W_MEMBERS=2, W_CHILDREN_5=5, W_ADULTS_65=4, W_PREGNANT=5, W_DISABLED=4, W_ZONE_RISK=3, W_DAYS_NO_AID=1.5, W_DELIVERIES=2, MAX_DAYS=30.

**Recálculo**: al crear entrega (RN-08), al cambiar composición familiar, o por endpoint `POST /prioritization/recalculate`.

La respuesta de ranking y detalle familia incluye `priority_score_breakdown` con cada factor desglosado (HU-08 CA2).

---

## Key Business Rules

> Cada RN se enforza dentro del stored procedure indicado. Node solo invoca y mapea errores SQLSTATE.

1. **RN-01 — Cobertura mínima**: cada entrega cubre al menos 3 días (0,6 kg/persona/día de alimentos). Enforzada en `sp_delivery_create` (CHECK `coverage_days >= 3` + `RAISE EXCEPTION` con `SH422`).
2. **RN-02 — Prevención de duplicidad**: no se entrega ayuda a una familia cuya cobertura anterior no ha expirado. Excepción: autorizada por COORDINADOR_LOGISTICA con justificación. Enforzada en `fn_delivery_check_eligibility` (chequea `delivery_date + coverage_days * interval '1 day' > now()`); excepción en `sp_delivery_create_exception` con `exception_reason` y `exception_authorized_by`.
3. **RN-03 — Capacidad de bodega**: `current_weight_kg` no puede superar `max_capacity_kg`. Alerta al 85%, bloqueo al 100%. Enforzada en `sp_donations_create`, `sp_inventory_adjust` y CHECK constraint a nivel tabla.
4. **RN-04 — Priorización**: fórmula configurable en `scoring_config` (pesos editables sin tocar código). Implementada en `fn_priority_score(p_family_id)`.
5. **RN-05 — Descuento automático**: al confirmar entrega, el inventario de la bodega de origen se decrementa en la misma transacción. Implementado dentro de `sp_delivery_create` (toda la transacción vive en el SP).
6. **RN-06 — Trazabilidad completa**: todo recurso rastreable desde donante → bodega → entrega → familia. Implementada en `fn_report_traceability` (recursive CTE).
7. **RN-07 — Códigos secuenciales**: `FAM-2026-NNNNN`, `DON-2026-NNNNN`, `ENT-2026-NNNNN`, `PLN-2026-NNNNN`. Generados por `fn_next_code(p_prefix)` que usa `SELECT … FOR UPDATE` sobre una secuencia/contador anual.
8. **RN-08 — Recálculo de prioridad**: al crear entrega, al cambiar composición del hogar, o bajo petición manual del coordinador. `sp_delivery_create` y `sp_persons_upsert_and_recalc` invocan `fn_priority_score` y persisten `priority_score` + `priority_score_breakdown`.
9. **RN-09 — Aviso de privacidad**: toda creación de familia requiere `privacy_consent_accepted=true` (Ley 1581/2012). Se persiste en `privacy_consents`. Enforzada en `sp_families_create_with_consent` (rechaza con `SH422` si el flag no llega).
10. **RN-10 — Ubicación requerida**: refugios y bodegas deben registrar latitud/longitud al crearse (NOT NULL). Las familias registran coordenadas opcionalmente. Aplicada con `NOT NULL` a nivel DDL en `shelters` y `warehouses`.
11. **Transacciones atómicas**: donaciones, entregas, ajustes de inventario y traslados se ejecutan **enteros dentro de un solo SP** con `BEGIN/EXCEPTION` o `PROCEDURE … COMMIT`. El backend Node nunca abre transacciones desde el cliente.
12. **Auditoría inalterable**: cada SP de mutación llama a `sp_audit_insert(...)` antes de retornar; los permisos del rol de aplicación revocan `UPDATE` y `DELETE` sobre `audit_logs` (RNF-09).

---

## Project Structure (Monolito)

```
SIGAH/
├── package.json                          # Root: scripts dev, build, start, test
├── .gitignore
│
├── server/                               # Backend TypeScript/Express
│   ├── package.json                      # Deps y scripts del backend
│   ├── tsconfig.json
│   ├── .env / .env.example
│   ├── db/                               # Artefactos SQL versionados
│   │   ├── migrations/                   # DDL en orden numérico (001_…sql)
│   │   ├── procedures/                   # CREATE OR REPLACE FUNCTION/PROCEDURE
│   │   │   ├── _common/                  # fn_next_code, fn_audit_insert, helpers
│   │   │   ├── users/                    # fn_users_*, sp_auth_login, sp_users_*
│   │   │   ├── zones/                    # fn_zones_*, sp_zones_*
│   │   │   └── …                         # un subdir por módulo de dominio
│   │   ├── seeds/                        # 001_admin_user.sql, 002_zones_monteria.sql, …
│   │   └── README.md                     # convenciones, errcodes SH4xx, naming
│   ├── src/
│   │   ├── index.ts                      # Entry point (pool.connect → app.listen)
│   │   ├── app.ts                        # Config Express
│   │   ├── config/
│   │   │   ├── database.ts               # pg.Pool singleton (reemplaza prisma.ts)
│   │   │   ├── env.ts
│   │   │   └── constants.ts              # Constantes de negocio
│   │   ├── db/
│   │   │   ├── client.ts                 # query, queryOne, withTransaction, mapPgError
│   │   │   ├── migrate.ts                # CLI runner: apply | status | reset
│   │   │   └── seed.ts                   # Ejecuta db/seeds/*.sql
│   │   ├── models/                       # M de MVC: wrappers tipados sobre fn_*/sp_*
│   │   ├── views/                        # V de MVC: serializers (DTOs de respuesta)
│   │   ├── services/                     # Orquestación entre modelos + JWT/bcrypt
│   │   ├── controllers/                  # C de MVC: HTTP handlers, sin lógica de negocio
│   │   ├── routes/                       # 18 routers Express
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts        # JWT
│   │   │   ├── role.middleware.ts        # authorize(...roles)
│   │   │   ├── audit.middleware.ts       # Propaga IP/UA al SP de mutación
│   │   │   ├── idempotency.middleware.ts # Idempotency-Key para /deliveries
│   │   │   ├── validate.middleware.ts
│   │   │   └── errorHandler.middleware.ts
│   │   ├── validators/                   # express-validator (validaciones de forma)
│   │   ├── types/
│   │   │   ├── entities.ts               # Interfaces TS espejo de tablas y enums
│   │   │   ├── pg-errors.ts              # SQLSTATE custom (SH4xx) → AppError
│   │   │   └── express.d.ts              # Augment Request (user, role)
│   │   └── utils/
│   │       ├── AppError.ts
│   │       ├── asyncHandler.ts
│   │       ├── pagination.ts
│   │       └── exporters/                # pdf.ts, xlsx.ts
│   └── tests/
│       ├── setup.ts                      # TRUNCATE … RESTART IDENTITY CASCADE
│       ├── unit/
│       └── integration/
│
└── client/                               # Frontend React (ver FRONTEND-PLAN.md)
    ├── package.json
    ├── vite.config.ts                    # Vite + proxy /api + vite-plugin-pwa
    ├── index.html                        # Con manifest PWA
    ├── public/                           # manifest.webmanifest, icons, marker-icons
    └── src/
        ├── lib/offlineQueue.ts           # Dexie + cola de mutaciones
        ├── lib/sw.ts                     # Service Worker config
        ├── context/SyncContext.tsx       # Estado de conexión y cola
        └── ...                           # Ver FRONTEND-PLAN.md
```

> **Nota**: Sin ORM. Sin capa de repositorio. La capa **`models/`** invoca stored procedures vía `pg`. Las funciones SQL devuelven la fila resultante para evitar round-trips. **Servicios** orquestan, **controllers** transportan HTTP, **vistas** serializan respuestas. Las transacciones viven íntegras dentro de los SPs (`BEGIN/EXCEPTION` o `PROCEDURE`/`COMMIT`); el cliente Node no abre transacciones.

### Convenciones de stored procedures

- **Naming**: `fn_<entidad>_<acción>` para FUNCTIONS que devuelven datos; `sp_<entidad>_<acción>` para PROCEDURES (operaciones complejas con `COMMIT`/`ROLLBACK` explícito).
- **Parámetros**: prefijados `p_` (`p_email`, `p_family_id`).
- **Idempotencia**: todos los `db/procedures/**/*.sql` usan `CREATE OR REPLACE`. El runner los re-aplica en cada `db:migrate`.
- **Errores tipados**: `RAISE EXCEPTION USING ERRCODE = 'SH4XX'`. Mapping centralizado en `src/types/pg-errors.ts`:
  - `SH401` UNAUTHORIZED · `SH403` FORBIDDEN · `SH404` NOT_FOUND · `SH409` CONFLICT · `SH422` UNPROCESSABLE · `SH423` LOCKED.
- **Auditoría**: cada SP de mutación llama internamente a `sp_audit_insert(action, module, entity, entity_id, user_id, before, after, ip, user_agent)`. El controller propaga IP y user-agent al servicio.
- **bcrypt**: la única lógica que NO baja al SP es `bcrypt.compare` y `bcrypt.hash` (viven en `auth.service.ts`). El SP recibe el hash pre-calculado.

### Scripts del monolito (root `package.json`, pnpm workspaces)

| Script | Comando | Descripción |
|--------|---------|-------------|
| `pnpm dev` | `concurrently` server + client | API (puerto 3000) + Vite HMR (5173) |
| `pnpm build` | build client + tsc server | Compila frontend y backend |
| `pnpm start` | `pnpm --filter server start` | Producción |
| `pnpm test` | `pnpm --filter server test` | Tests del backend |
| `pnpm db:up` / `db:down` | docker-compose up/down | Levanta/baja PostgreSQL |
| `pnpm db:migrate` | `pnpm --filter server db:migrate` | Aplica migraciones SQL pendientes + recarga procedures |
| `pnpm db:seed` | `pnpm --filter server db:seed` | Ejecuta `db/seeds/*.sql` |
| `pnpm db:reset` | drop schema + migrate + seed | Reset completo (solo dev) |

### Producción

`server/src/index.ts` sirve el frontend compilado:
```ts
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});
```

---

## Main Libraries

### Backend
| Librería | Uso |
|---|---|
| express ^5 | Framework HTTP |
| pg ^8 | Cliente PostgreSQL (`Pool`, `client.query`) — única dependencia de acceso a datos |
| @types/pg (devDep) | Tipos TS para `pg` |
| bcrypt ^6 | Hash y compare de contraseñas (única lógica que NO vive en SPs) |
| jsonwebtoken ^9 | JWT |
| express-validator ^7 | Validación de forma (regex, longitudes) — la lógica de negocio vive en SPs |
| express-rate-limit | Rate limiting en `/auth/login` |
| cors, helmet, morgan | Seguridad y logging |
| exceljs, pdfkit | Exportes Excel y PDF (HU-28, HU-29) |
| dotenv, tsx, typescript | Base |
| jest ^30 + supertest ^7 | Tests |

### Frontend (detalles en FRONTEND-PLAN.md)
React 19, Vite 8, TanStack Query/Form/Table, Tailwind 4, Leaflet, Recharts, Axios, Zod, **vite-plugin-pwa**, **workbox-window**, **dexie**, **jspdf**/**xlsx**/**file-saver**.

---

## Implementation Plan (16 pasos)

### Paso 1: Inicialización del proyecto ✅
Estructura del monolito, `server/` y `client/`, dependencias, Vite proxy, config de TS strict. Variables de entorno. **(Issues #1-#3)**

### Paso 2: Infraestructura base ✅
`app.ts`, `index.ts`, utilidades (AppError, asyncHandler, pagination), error handler global, validate middleware. **(Issues #4-#6)**

### Paso 3: Autenticación (v1) ✅
Modelo User, migración, auth.service con bcrypt + JWT, auth y role middlewares, seed admin. **(Issues #7-#9)**

### Paso 3.1: Adaptación Auth a requerimientos finales
Migración `add-roles-and-user-fields`: renombra enum `Role` a los 6 valores finales (`ADMIN`, `CENSADOR`, `OPERADOR_ENTREGAS`, `COORDINADOR_LOGISTICA`, `FUNCIONARIO_CONTROL`, `REGISTRADOR_DONACIONES`), añade campos a User (name, is_active, failed_login_attempts, locked_until, last_login_at, password_must_change). Validator password >= 8 caracteres. Login con lockout tras 5 intentos. Seed actualiza name. Constantes: prefijo `ENT`, alerta 85%. **(Issue #9.1)**

### Paso 3.2: Migración a `pg` + arquitectura MVC + Stored Procedures 🆕
**Cambio fundacional**: se elimina Prisma del stack y se adopta `pg` (node-postgres) puro como única dependencia de acceso a datos. Toda la lógica de negocio baja a stored procedures (PL/pgSQL). El backend pasa a MVC + Service layer:
- `server/db/{migrations,procedures,seeds}/` con `.sql` planos versionados.
- `server/src/db/{client,migrate,seed}.ts` runner casero (no se usa Prisma CLI ni `node-pg-migrate`).
- `server/src/{models,views}/` nuevos: `models/` envuelven `fn_*`/`sp_*` con tipos estrictos; `views/` serializan respuestas.
- `server/src/types/{entities,pg-errors}.ts`: interfaces TS espejo del esquema + mapping `SH4xx → AppError`.
- Reescritura de `auth` y `zones` (ya implementados) sobre el nuevo patrón.
- Borrado de `server/prisma/`, `config/prisma.ts`, deps `@prisma/*`.
- Seeds `001_admin_user.sql` y `002_zones_monteria.sql`.
**(Issue #9.2)**

### Paso 4: Zonas y refugios
Modelos Zone, Shelter (coordenadas NOT NULL en Shelter). CRUD. Alerta de ocupación >90% en refugios. Seeds con zonas reales de Montería. **(Issues #10-#11)**

### Paso 5: Familias, personas y consentimiento de privacidad
Modelos Family, Person, PrivacyConsent. Estado familia = ACTIVE/IN_SHELTER/EVACUATED. POST /families exige consentimiento. Código secuencial FAM. Triggers de composición que recalculan puntaje. **(Issues #12-#14)**

### Paso 6: Bodegas, recursos e inventario
Modelos Warehouse (coordenadas NOT NULL), ResourceType (con is_active), Inventory, InventoryAdjustment, AlertThreshold. Ajustes manuales con motivo obligatorio. Alertas configurables. Bodega más cercana por Haversine. **(Issues #15-#17)**

### Paso 7: Donantes y donaciones
Modelos Donor (nuevo enum, contact requerido, unique compuesto), Donation, DonationDetail. Creación transaccional que actualiza inventario bodega destino. Historial por donante. **(Issues #18-#19)**

### Paso 8: Priorización configurable
Tabla scoring_config con seed. `prioritization.service.ts` lee desde BD con caché invalidable. Endpoints GET/PUT /scoring-config. Ranking incluye breakdown. **(Issues #20-#21, #45)**

### Paso 9: Entregas
Modelo Delivery (prefijo DEL, estados EN, excepciones), DeliveryDetail. Verificación de elegibilidad. Cálculo de ración mínima. Creación transaccional con Idempotency-Key. Entrega por lote. Excepción autorizada por coordinador. **(Issues #22-#24)**

### Paso 10: Planes de distribución
Modelos DistributionPlan, DistributionPlanItem. Generación priorizada con scope (GLOBAL/ZONE/SHELTER/BATCH). Estados SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED. Ejecución que materializa entregas. **(Issue #46)**

### Paso 11: Salubridad y traslados
Modelos HealthVector (con status y vector_type literal), Relocation. PUT /status para vectores. Traslados ajustan ocupación origen/destino. **(Issues #25-#26)**

### Paso 12: Auditoría inmutable
Tabla `audit_logs`, función `sp_audit_insert(...)` invocada desde **dentro de cada SP de mutación** (no es un middleware: la auditoría es una llamada al SP que la propia transacción de negocio hace antes de retornar, garantizando que ninguna mutación quede sin registro aunque la transacción falle parcialmente). Captura `before/after` en JSONB, IP y user_agent (los recibe como parámetros del controller). `GET /audit` con filtros para FUNCIONARIO_CONTROL/ADMIN. Migración con `REVOKE UPDATE, DELETE ON audit_logs FROM <app_role>`. **(Issue #28)**

### Paso 13: Mapa y reportes con export
Endpoints de mapa (incluye zonas sin entregas). Reportes completos con `?format=json|pdf|xlsx`. Dashboard con indicadores clave. Reporte de trazabilidad donante→familia. **(Issues #27-#29)**

### Paso 14: PWA + offline + sincronización
Frontend: Service Worker, manifest, cache shell, Dexie para cola de ops offline, UI ConnectionBadge. Backend: `POST /sync` con deduplicación por `client_op_id`. Flujos offline-first para censo y entregas. **(Issue #48)**

### Paso 15: Tests y seeds de demo
Tests unitarios (priorización, elegibilidad, capacidad, lockout), tests de integración (auth completo, donación→inventario→entrega→recálculo, plan de distribución end-to-end, auditoría). Seed de demo con familias, donantes, bodegas, entregas reales de Montería. **(Issue #30)**

---

## Verification

1. **DB clean reset**: `pnpm db:reset` recrea `public` schema, aplica todas las migraciones SQL y recarga todos los `db/procedures/**/*.sql` sin errores. `SELECT count(*) FROM pg_proc WHERE proname LIKE 'fn_%' OR proname LIKE 'sp_%'` retorna el total esperado.
2. **No queda Prisma**: `grep -r "prisma\|@prisma" server/src server/tests server/package.json` no devuelve nada.
3. **Tests unitarios**: `pnpm test` desde la raíz. Cubren priorización, lockout, elegibilidad, capacidad de bodega, ración mínima, auditoría — invocando los SPs reales contra una BD de test.
4. **Tests de integración**: flujo completo auth (register, login, lockout, password_must_change, role protection); flujo donación → inventario → plan → entrega → auditoría, todo orquestado por SPs.
5. **Build**: `pnpm build` desde la raíz — compila frontend y backend.
6. **Modo producción**: `pnpm start` — Express sirve API en `/api/v1` y frontend en `/`.
7. **Modo desarrollo**: `pnpm dev` — Vite (5173) + Express (3000) concurrentes.
8. **Ley 1581/2012**: intentar crear familia sin `privacy_consent_accepted=true` falla con 422 (lanzado por `sp_families_create_with_consent`, ERRCODE `SH422`).
9. **Offline**: desconectar red, registrar familia y entrega en frontend, reconectar — los registros se sincronizan vía `/sync` (que delega en `sp_sync_apply_op`).
10. **Auditoría inmutable**: ejecutar manualmente `UPDATE audit_logs SET …` con el rol de la app falla por permisos (`REVOKE` aplicado en migración).
11. **Exports**: cada reporte descarga correctamente PDF y Excel.
12. **RBAC**: los 6 roles ven solo las acciones que les corresponden según la matriz RBAC (FRONTEND-PLAN §7).
13. **Capacidad bodega**: intentar cargar donación o ajuste que exceda `max_capacity_kg` falla con 422 (lanzado por `sp_donations_create` / `sp_inventory_adjust`).
14. **Duplicidad entrega**: segunda entrega a familia con cobertura vigente falla con 409 (`fn_delivery_check_eligibility` → ERRCODE `SH409`), a menos que COORDINADOR_LOGISTICA use `/deliveries/exception` con justificación.
15. **Performance**: consulta `GET /families/search?q=X` responde en <2s con 12.000 familias (RNF-04). El SP `fn_families_search` usa índices `pg_trgm` en `family_code`/`head_document`/`reference_address`.
