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

**Stack**: Node.js + Express 5 | TypeScript strict | PostgreSQL + Prisma 7 | JWT | React 19 + Vite 8 + TypeScript | PWA (Service Worker + IndexedDB) | Monolito

**Arquitectura**: Monolítica — Express sirve la API REST (`/api/v1`) y el frontend React compilado (`client/dist/`). En desarrollo, Vite proxy-a peticiones `/api` a Express (puerto 3000). En producción ambos se sirven desde el mismo origen.

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
- POST donations (si es IN_KIND/MIXED, transacción `prisma.$transaction()` que actualiza inventario de bodega destino).
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

1. **RN-01 — Cobertura mínima**: cada entrega cubre al menos 3 días (0,6 kg/persona/día de alimentos).
2. **RN-02 — Prevención de duplicidad**: no se entrega ayuda a una familia cuya cobertura anterior no ha expirado. Excepción: autorizada por LOGISTICS_COORDINATOR con justificación.
3. **RN-03 — Capacidad de bodega**: `current_weight_kg` no puede superar `max_capacity_kg`. Alerta al 85%, bloqueo al 100%.
4. **RN-04 — Priorización**: fórmula configurable en `scoring_config` (pesos editables sin tocar código).
5. **RN-05 — Descuento automático**: al confirmar entrega, el inventario de la bodega de origen se decrementa en la misma transacción.
6. **RN-06 — Trazabilidad completa**: todo recurso rastreable desde donante → bodega → entrega → familia (endpoint `/reports/traceability`).
7. **RN-07 — Códigos secuenciales**: `FAM-2026-NNNNN`, `DON-2026-NNNNN`, `DEL-2026-NNNNN`, `PLN-2026-NNNNN`.
8. **RN-08 — Recálculo de prioridad**: al crear entrega, al cambiar composición del hogar, o bajo petición manual del coordinador.
9. **RN-09 — Aviso de privacidad**: toda creación de familia requiere `privacy_consent_accepted=true` (Ley 1581/2012). Se persiste en `privacy_consents`.
10. **RN-10 — Ubicación requerida**: refugios y bodegas deben registrar latitud/longitud al crearse (NOT NULL). Las familias registran coordenadas opcionalmente.
11. **Transacciones atómicas**: donaciones, entregas, ajustes de inventario y traslados usan `prisma.$transaction()` para consistencia.
12. **Auditoría inalterable**: toda mutación pasa por el middleware que crea un registro en `audit_logs`. El usuario de la BD de la app tiene solo INSERT/SELECT sobre esa tabla (UPDATE/DELETE revocados).

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
│   ├── prisma/
│   │   ├── schema.prisma                 # 22 tablas
│   │   ├── migrations/                   # Migraciones generadas por Prisma
│   │   └── seed.ts                       # Admin + scoring_config + catálogo recursos
│   ├── src/
│   │   ├── index.ts                      # Entry point (API + client/dist en prod)
│   │   ├── app.ts                        # Config Express
│   │   ├── config/
│   │   │   ├── prisma.ts                 # PrismaClient singleton con PrismaPg adapter
│   │   │   ├── env.ts
│   │   │   └── constants.ts              # Constantes de negocio
│   │   ├── routes/                       # 18 archivos de rutas
│   │   ├── controllers/                  # 18 controladores
│   │   ├── services/                     # 18 servicios
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts        # JWT
│   │   │   ├── role.middleware.ts        # authorize(...roles)
│   │   │   ├── audit.middleware.ts       # Registra mutaciones en audit_logs
│   │   │   ├── idempotency.middleware.ts # Idempotency-Key para /deliveries
│   │   │   ├── validate.middleware.ts
│   │   │   └── errorHandler.middleware.ts
│   │   ├── validators/
│   │   └── utils/
│   │       ├── AppError.ts
│   │       ├── asyncHandler.ts
│   │       ├── pagination.ts
│   │       ├── codeGenerator.ts          # FAM/DON/DEL/PLN
│   │       └── exporters/                # pdf.ts, xlsx.ts
│   └── tests/
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

> **Nota**: No hay capa de repositorio. Prisma Client actúa como ORM y capa de acceso a datos. Los servicios interactúan directamente con `prisma`, usando `prisma.$transaction()` para operaciones atómicas.

### Scripts del monolito (root `package.json`)

| Script | Comando | Descripción |
|--------|---------|-------------|
| `npm run dev` | `concurrently` server + client | API (puerto 3000) + Vite HMR (5173) |
| `npm run build` | build client + tsc server | Compila frontend y backend |
| `npm start` | `npm --prefix server run start` | Producción |
| `npm test` | `npm --prefix server run test` | Tests del backend |
| `npm run install:all` | install en ambos subproyectos | |

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
| @prisma/client ^7 | ORM |
| @prisma/adapter-pg ^7 | Adapter PostgreSQL |
| prisma ^7 (devDep) | Migraciones y generación de cliente |
| bcrypt ^6 | Hash de contraseñas |
| jsonwebtoken ^9 | JWT |
| express-validator ^7 | Validación de requests |
| express-rate-limit | Rate limiting en `/auth/login` |
| cors, helmet, morgan | Seguridad y logging |
| exceljs, pdfkit | Exportes Excel y PDF (HU-28, HU-29) |
| dotenv, tsx, typescript | Base |
| jest ^30 + supertest ^7 | Tests |

### Frontend (detalles en FRONTEND-PLAN.md)
React 19, Vite 8, TanStack Query/Form/Table, Tailwind 4, Leaflet, Recharts, Axios, Zod, **vite-plugin-pwa**, **workbox-window**, **dexie**, **jspdf**/**xlsx**/**file-saver**.

---

## Implementation Plan (15 pasos)

### Paso 1: Inicialización del proyecto ✅
Estructura del monolito, `server/` y `client/`, dependencias, Vite proxy, Prisma init, config de TS strict. Variables de entorno. **(Issues #1-#3)**

### Paso 2: Infraestructura base ✅
`app.ts`, `index.ts`, utilidades (AppError, asyncHandler, pagination), error handler global, validate middleware. **(Issues #4-#6)**

### Paso 3: Autenticación (v1) ✅
Modelo User, migración, auth.service con bcrypt + JWT, auth y role middlewares, seed admin. **(Issues #7-#9)**

### Paso 3.1: Adaptación Auth a requerimientos finales
Migración `add-roles-and-user-fields`: renombra enum `Role` a los 6 valores finales (`ADMIN`, `CENSUS_TAKER`, `DELIVERY_OPERATOR`, `LOGISTICS_COORDINATOR`, `CONTROL_OFFICER`, `DONATION_REGISTRAR`), añade campos a User (name, is_active, failed_login_attempts, locked_until, last_login_at, password_must_change). Validator password >= 8 caracteres. Login con lockout tras 5 intentos. Seed actualiza name. Constantes: prefijo `DEL`, alerta 85%. **(Issue #9.1)**

### Paso 4: Zonas y refugios
Modelos Zone, Shelter (coordenadas NOT NULL en Shelter). CRUD. Alerta de ocupación >90% en refugios. Seeds con zonas reales de Montería. **(Issues #10-#11)**

### Paso 5: Familias, personas y consentimiento de privacidad
Modelos Family, Person, PrivacyConsent. Estado familia = ACTIVE/IN_SHELTER/EVACUATED. POST /families exige consentimiento. Código secuencial FAM. Triggers de composición que recalculan puntaje. **(Issues #12-#14)**

### Paso 6: Bodegas, recursos e inventario
Modelos Warehouse (coordenadas NOT NULL), ResourceType (con is_active), Inventory, InventoryAdjustment, AlertThreshold. Ajustes manuales con motivo obligatorio. Alertas configurables. Bodega más cercana por Haversine. **(Issues #15-#17)**

### Paso 7: Donantes y donaciones
Modelos Donor (nuevo enum, contact requerido, unique compuesto), Donation, DonationDetail. Creación transaccional que actualiza inventario bodega destino. Historial por donante. **(Issues #18-#19)**

### Paso 8: Priorización configurable
Tabla scoring_config con seed. `prioritization.service.ts` lee desde BD con caché invalidable. Endpoints GET/PUT /scoring-config. Ranking incluye breakdown. **(Issue #20-#21)**

### Paso 9: Entregas
Modelo Delivery (prefijo DEL, estados EN, excepciones), DeliveryDetail. Verificación de elegibilidad. Cálculo de ración mínima. Creación transaccional con Idempotency-Key. Entrega por lote. Excepción autorizada por coordinador. **(Issues #22-#24)**

### Paso 10: Planes de distribución
Modelos DistributionPlan, DistributionPlanItem. Generación priorizada con scope (GLOBAL/ZONE/SHELTER/BATCH). Estados SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED. Ejecución que materializa entregas. **(Issue #25)**

### Paso 11: Salubridad y traslados
Modelos HealthVector (con status y vector_type literal), Relocation. PUT /status para vectores. Traslados ajustan ocupación origen/destino. **(Issues #26-#27)**

### Paso 12: Auditoría inmutable
Tabla audit_logs, middleware de auditoría que registra mutaciones (before/after, IP, user_agent), GET /audit con filtros. Permisos SQL que prohíben UPDATE/DELETE sobre audit_logs. **(Issue #28)**

### Paso 13: Mapa y reportes con export
Endpoints de mapa (incluye zonas sin entregas). Reportes completos con `?format=json|pdf|xlsx`. Dashboard con indicadores clave. Reporte de trazabilidad donante→familia. **(Issues #29-#31)**

### Paso 14: PWA + offline + sincronización
Frontend: Service Worker, manifest, cache shell, Dexie para cola de ops offline, UI ConnectionBadge. Backend: `POST /sync` con deduplicación por `client_op_id`. Flujos offline-first para censo y entregas. **(Issue #32)**

### Paso 15: Tests y seeds de demo
Tests unitarios (priorización, elegibilidad, capacidad, lockout), tests de integración (auth completo, donación→inventario→entrega→recálculo, plan de distribución end-to-end, auditoría). Seed de demo con familias, donantes, bodegas, entregas reales de Montería. **(Issue #33)**

---

## Verification

1. **Tests unitarios**: `npm test` desde la raíz. Cubren priorización, lockout, elegibilidad, capacidad de bodega, ración mínima, auditoría.
2. **Tests de integración**: flujo completo auth (register, login, lockout, password_must_change, role protection); flujo donación → inventario → plan → entrega → auditoría.
3. **Build**: `npm run build` desde la raíz — compila frontend y backend.
4. **Modo producción**: `npm start` — Express sirve API en `/api/v1` y frontend en `/`.
5. **Modo desarrollo**: `npm run dev` — Vite (5173) + Express (3000) concurrentes.
6. **Ley 1581/2012**: intentar crear familia sin `privacy_consent_accepted=true` debe fallar con 400.
7. **Offline**: desconectar red, registrar familia y entrega en frontend, reconectar — los registros deben sincronizarse vía `/sync`.
8. **Auditoría**: verificar que un INTENTO de UPDATE sobre `audit_logs` falla (rol SQL de la app sin permisos).
9. **Exports**: cada reporte descarga correctamente PDF y Excel.
10. **RBAC**: los 6 roles ven solo las acciones que les corresponden según la matriz RBAC (FRONTEND-PLAN §7).
11. **Capacidad bodega**: intentar cargar donación o ajuste que exceda `max_capacity_kg` debe fallar con 400.
12. **Duplicidad entrega**: segunda entrega a familia con cobertura vigente falla con 409, a menos que LOGISTICS_COORDINATOR use `/deliveries/exception` con justificación.
13. **Performance**: consulta `GET /families/search?q=X` responde en <2s con 12.000 familias (RNF-04).
