# SIGAH Frontend Plan (Vue 3)

> Esta es la versión **Vue 3** del plan de frontend y es la **fuente de verdad** actual.
> Sustituye a `FRONTEND-PLAN.md` (escrito para React, ahora desactualizado).
> El backend (18 módulos en `/api/v1`) ya está implementado; ver `HistoriasDeUsuario.json`.

## Context

El frontend es una **SPA Vue 3 mobile-first y PWA offline-capable** que vive en el monolito bajo `SIGAH/client/` y consume la API definida en PLAN.md (18 módulos, 22 tablas, 44 RF, 10 RN, 31 HU). El 90% del trabajo de campo se hace desde smartphone, por lo que la experiencia móvil es prioritaria. El sistema debe funcionar con conectividad pobre o nula: censo y entregas se guardan localmente en IndexedDB y se sincronizan al recuperar conexión.

En producción, Express sirve el bundle compilado (`client/dist/`) y la API. En desarrollo, Vite proxy-a `/api` al backend (3000).

---

## 1. Tech Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Build | Vite 8.x | HMR rápido, zero-config Vue + TS |
| UI | Vue 3.5.x (Composition API, `<script setup>`) | Reactividad, SFCs, TS-first |
| Lenguaje | TypeScript strict | Type safety total |
| Routing | Vue Router 5.x | Layouts anidados, navigation guards |
| Server state | TanStack Query (`@tanstack/vue-query`) 5.x | Caching, persistencia, reintentos offline |
| Client state | Pinia 3.x | Auth y Sync (stores, sin Redux) |
| Styling | TailwindCSS 4.x | Utility-first, responsive, mobile-first |
| Accessible UI | `@headlessui/vue` 1.7.x | Modales, dropdowns, combobox, tabs |
| Forms | VeeValidate 4.x + Zod 4.x | Validación type-safe |
| Tablas | `@tanstack/vue-table` 8.x | Headless sort/paginación |
| Charts | `vue-chartjs` 5.x + Chart.js 4.x | Dashboard y reportes (Recharts no tiene port Vue) |
| Mapas | `@vue-leaflet/vue-leaflet` + Leaflet 1.9 | OSM gratis, clustering, markers |
| HTTP | Axios 1.x | Interceptor JWT, 401 handler, Idempotency-Key |
| Íconos | `@lucide/vue` | Tree-shakable (reemplaza `lucide-vue-next`, deprecado) |
| Toasts | `vue-sonner` 2.x | Notificaciones minimalistas |
| Fechas | date-fns 4.x | Formateo ligero |
| **PWA** | **vite-plugin-pwa + workbox-window** | Service Worker, manifest, offline shell |
| **IndexedDB** | **dexie 4.x** | Cola de operaciones offline |
| **Persist cache** | **@tanstack/query-persist-client-core** | Cache de query entre sesiones |
| **Exports** | **jspdf + jspdf-autotable, xlsx, file-saver** | Descargar reportes en PDF/Excel |

> **Equivalencias React → Vue** (por si se consulta el plan antiguo): React→Vue 3, React Router→Vue Router, TanStack Query React→`@tanstack/vue-query`, React Context/useReducer→Pinia, Headless UI React→`@headlessui/vue`, TanStack Form→VeeValidate, Recharts→`vue-chartjs`, react-leaflet→`@vue-leaflet/vue-leaflet`, lucide-react→`@lucide/vue`, sonner→`vue-sonner`. Carpetas: `hooks/`→`composables/`, `context/`→`stores/`.

---

## 2. Módulos frontend (15 → 18 APIs backend)

| # | Módulo | APIs backend (`/api/v1`) | Responsabilidad |
|---|--------|-------------|-----------------|
| 1 | Auth | `/auth` | Login con lockout, cambio obligatorio de contraseña, gestión de usuarios |
| 2 | Dashboard | `/reports/dashboard`, `/inventory/alerts` | KPIs, alertas activas |
| 3 | Familias y Personas | `/families`, `/persons`, `/prioritization` | Censo offline, consentimiento privacidad, puntaje con desglose |
| 4 | Zonas | `/zones` | CRUD, detalle con pestañas |
| 5 | Refugios | `/shelters` | CRUD con mapa, ocupación |
| 6 | Bodegas e Inventario | `/warehouses`, `/resource-types`, `/inventory`, `/alert-thresholds` | CRUD, ajustes con motivo, alertas configurables |
| 7 | Donantes y Donaciones | `/donors`, `/donations` | Registro con contact, donación con ítems |
| 8 | Entregas | `/deliveries`, `/prioritization` | Entrega individual offline, batch, excepciones |
| 9 | Planes de Distribución | `/distribution-plans` | Generación priorizada, ejecución |
| 10 | Reportes | `/reports` | Reportes con export PDF/Excel |
| 11 | Vectores Sanitarios | `/health-vectors` | CRUD con estado |
| 12 | Traslados | `/relocations` | Relocalización de familias |
| 13 | Mapa | `/map` | Visualización geoespacial con capas |
| 14 | Auditoría | `/audit-logs` | Historial inmutable (FUNCIONARIO_CONTROL/ADMIN) |
| 15 | Configuración | `/scoring-config`, `/alert-thresholds` | Pesos del puntaje y umbrales editables |

> **Nota de paths reales** (confirmados en `server/src/app.ts`): el backend monta `/api/v1/health-vectors` y `/api/v1/audit-logs` (no `/health/vectors` ni `/audit` como decía el plan React).

---

## 3. Vistas (páginas de la app)

> Cada página es un SFC `.vue` bajo `src/pages/<módulo>/`. Las referencias HU-XX/CA-X y RN-XX provienen de PLAN.md y `HistoriasDeUsuario.json`.

### 3.0 Auth

**Login (`/login`)** — Card centrado full-page, sin navbar/sidebar. Form: Email, Contraseña. Si `locked_until` activo: mensaje con cuenta regresiva (HU-02 CA5). Si `password_must_change=true`: redirige a `/change-password`. Guarda JWT (Pinia + localStorage). API: `POST /auth/login`, `GET /auth/me`.

**Cambiar contraseña (`/change-password`)** — Contraseña actual, nueva, confirmar (mínimo 8). Obligatorio cuando `password_must_change=true` (guard). API: `PUT /auth/change-password`.

**Usuarios (`/users`) — solo ADMIN** — Tabla (Nombre, Email, Rol, Estado, Último acceso, Acciones). "Registrar Usuario" → modal con rol (6 opciones) y contraseña temporal. Acciones: editar rol, activar/desactivar (no eliminar), resetear contraseña. APIs: `POST /auth/register`, `PUT /auth/users/:id`, `POST /auth/reset-password/:userId`, `GET /auth/users`.

### 3.1 Dashboard (`/dashboard`)

Pantalla de inicio para COORDINADOR_LOGISTICA y FUNCIONARIO_CONTROL (HU-27 CA3).
- **6 KPI cards**: total familias, atendidas (%), pendientes (rojo si >0), entregas hoy, peso almacenado vs capacidad, alertas activas.
- Gráficos: barras "Entregas por Zona", pie "Donaciones por Tipo", línea "Entregas 30 días", barras horizontales "Inventario por Categoría".
- Tabla "Entregas recientes".
- APIs: `GET /reports/dashboard`, `/reports/coverage`, `/reports/deliveries-by-zone`, `/reports/donations-by-type`, `/reports/unattended-families`, `/inventory/alerts`.

### 3.2 Familias y Personas

**Lista (`/families`)** — Búsqueda unificada (código FAM / documento / dirección, HU-06 CA1). Filtros: zona, estado, refugio. Columnas: Código, Documento, Zona, Refugio, Miembros, Niños<5, Puntaje, Estado, Última entrega. "Registrar Familia" (offline). Paginación 20. API: `GET /families?q=&zone_id=&status=&shelter_id=`.

**Formulario (`/families/new`, `/families/:id/edit`)** — Mobile-first, offline (HU-04 CA4-5). Básico (código auto, documento, zona, refugio, estado, dirección), composición, ubicación opcional (MapPicker). **Checkbox obligatorio** "Acepto el aviso de privacidad (Ley 1581/2012)" — bloquea submit si no marcado (RN-09). Offline: toast "Guardado localmente". API: `POST /families` (con `privacy_consent_accepted=true`) / `PUT /families/:id`.

**Detalle (`/families/:id`)** — Header (código, estado, puntaje, zona, refugio). Card "Puntaje de Prioridad" con desglose por factor (HU-08 CA2). Tabs: Miembros (tabla + "Agregar Miembro"), Historial de entregas, Elegibilidad. Mini-mapa si hay coords. APIs: `GET /families/:id`, `/families/:id/persons`, `/families/:id/deliveries`, `/families/:id/eligibility`.

**Búsqueda de personas (`/persons/search`)** — Input por documento → card con datos. API: `GET /persons/search?document=X`.

### 3.3 Zonas

**Lista (`/zones`)** — Grid de cards (nombre, badge de riesgo, población, counts). "Agregar Zona". **Form (modal)**: nombre, riesgo, población, lat, lng. **Detalle (`/zones/:id`)**: header + tabs (Familias, Refugios, Bodegas) + mini-mapa. APIs: CRUD `/zones`, `/zones/:id/{families,shelters,warehouses}`.

### 3.4 Refugios (`/shelters`)

Tabla (Nombre, Dirección, Zona, Tipo, Capacidad, Ocupación, % con barra: verde <70%, amarillo 70-90%, rojo >90% — HU-10 CA2). Filtro por zona. Form modal con **mapa obligatorio** (HU-10 CA5). Modal de ocupación (valida max_capacity). APIs: CRUD `/shelters`, `PUT /shelters/:id/occupancy`.

### 3.5 Bodegas e Inventario

**Bodegas (`/warehouses`)** — Tabla (Nombre, Dirección, Zona, Capacidad, Peso, % uso). **Alerta al 85%** (HU-11 CA3), **bloqueo al 100%** (HU-11 CA4). Form con **mapa obligatorio** (HU-11 CA2). APIs: CRUD `/warehouses`, `GET /warehouses/:id/inventory`, `GET /warehouses/nearest?lat=&lng=&limit=`.

**Detalle bodega (`/warehouses/:id`)** — Tabla inventario con expiraciones resaltadas. "Ajustar" → modal motivo (SHRINKAGE/DAMAGE/RETURN/CORRECTION) + nota obligatoria (HU-17 CA1-2), bloquea stock negativo (HU-17 CA3). API: `PUT /inventory/:id/adjustment`.

**Catálogo recursos (`/inventory/resource-types`)** — CRUD con filtro por categoría, `is_active` en vez de delete (HU-14 CA4). **Resumen (`/inventory/summary`)** — cards por categoría + bar chart. **Alertas (`/inventory/alerts`)** — cards con severidad. **Umbrales (`/settings/alerts`)** — tabla configurable (HU-16 CA2). APIs: CRUD `/resource-types`, `GET /inventory`, `/inventory/summary`, `/inventory/alerts`, `GET/PUT /alert-thresholds`.

### 3.6 Donantes y Donaciones

**Donantes (`/donors`)** — Tabla (Nombre, Tipo badge, Contact, Total, Acciones). Form: Nombre, Tipo (5 opciones), Contact (requerido), Tax ID. Unique (name, type) (HU-18 CA3). **Donaciones (`/donations`, `/donations/new`)** — form multi-sección con cálculo de peso automático y alerta si excede capacidad de bodega destino (HU-19 CA3). APIs: CRUD `/donors`, `GET /donors/:id/donations`, `POST/GET /donations`.

### 3.7 Entregas

**Lista (`/deliveries`)** — Estados: PROGRAMADA (gris), EN_CURSO (azul), ENTREGADA (verde). Filtros: zona, estado, fechas, bodega. "Crear Entrega", "Entrega por Lote".

**Form (`/deliveries/new`) — multi-step, offline**:
1. **Familia**: búsqueda + elegibilidad. Si cobertura vigente: bloqueo "Faltan X días". "Autorizar excepción" solo COORDINADOR_LOGISTICA con justificación (HU-23 CA5).
2. **Bodega**: select o "más cercana", muestra inventario.
3. **Ítems**: filas dinámicas, cobertura automática (0,6 kg/persona/día), alerta si <3 días, "Recibido por".
4. **Confirmar**: resumen + coordenadas.
Offline: `client_op_id` + IndexedDB; al sincronizar Axios envía `Idempotency-Key`. API: `POST /deliveries`.

**Entrega por lote (`/deliveries/batch`)** — preview top N priorizadas + bodega + paquete. APIs: `GET /prioritization/next-batch`, `POST /deliveries/batch`. **Excepción**: `POST /deliveries/exception`.

**Detalle (`/deliveries/:id`)** — header, ítems, `PUT /deliveries/:id/status`, mini-mapa.

**Ranking (`/deliveries/ranking`)** — tabla con puntaje y "Ver desglose", botón "Recalcular todos" (ADMIN/COORD). APIs: `GET /prioritization/ranking`, `POST /prioritization/recalculate`.

### 3.8 Planes de Distribución (`/distribution-plans`) — HU-21

**Lista** — Tabla (Código PLN, Creado por, Fecha, Estado, Scope, # familias). **Nuevo (`/new`) — wizard**: Scope (GLOBAL/ZONA/REFUGIO/LOTE) → Preview (elegibles ordenadas, asignación por bodega, alerta "N sin atender" HU-21 CA4) → Confirmar (PROGRAMADA). **Detalle (`/:id`)** — "Ejecutar" / "Cancelar" + tabla de items. APIs: `POST/GET /distribution-plans`, `GET /distribution-plans/:id`, `POST /:id/execute`, `PUT /:id/cancel`.

### 3.9 Reportes (`/reports`)

Hub de cards. Cada reporte con **"Exportar PDF" y "Exportar Excel"** (HU-28 CA4, HU-29 CA5):
- Cobertura (`/reports/coverage`), Inventario (`/reports/inventory`), Donaciones por tipo (`/reports/donations`), Entregas por zona (`/reports/deliveries-zone`), Familias no atendidas (`/reports/unattended`), Zonas sin entregas (`/reports/zones-without-deliveries` — HU-30), Trazabilidad (`/reports/traceability` — HU-29, filtros donante/rango/zona; cadena donante→bodega→entrega→familia).
- APIs: `GET /reports/*` con `?format=json|pdf|xlsx`.

### 3.10 Vectores Sanitarios (`/health/vectors`)

Tabla (Tipo, Riesgo badge, Zona/Refugio, Estado ACTIVO/EN_ATENCION/RESUELTO — HU-25 CA2, Acciones, Fecha). Filtros por estado/vector_type/zona. "Cambiar estado" → modal. Form con mapa (marker arrastrable). APIs: CRUD `/health-vectors`, `PUT /health-vectors/:id/status`.

### 3.11 Traslados (`/relocations`)

Tabla (Familia, Origen, Destino, Tipo, Fecha, Autorizado por). Form: familia (searchable), origen (auto), destino (excluye origen, valida capacidad — HU-24 CA3), tipo, motivo. APIs: `GET/POST /relocations`.

### 3.12 Mapa (`/map`)

Leaflet centrado en Montería (8.7479, -75.8814), zoom 13. **Capas toggle independientes** (HU-13 CA2): Refugios (azul), Bodegas (verde), Familias (naranja, clustered, popup sin datos sensibles), Vectores (rojo, default ACTIVO+EN_ATENCION HU-26 CA3, iconos por riesgo), Entregas recientes (morado), **Zonas sin entregas** (resaltado amarillo HU-30 CA4). Filtro de zona + leyenda. Familias sin coords agrupadas por zona (HU-13 CA5). APIs: `GET /map/{shelters,warehouses,families,vectors,zone/:id,recent-deliveries,zones-without-deliveries}`.

### 3.13 Auditoría (`/audit`) — FUNCIONARIO_CONTROL / ADMIN

Tabla (Fecha, Usuario, Acción, Módulo, Entidad, ID, IP) + columna expandible con diff `before`/`after`. Filtros: usuario, módulo, acción, rango (HU-31 CA3). Export PDF/Excel. **Sin mutaciones** (RNF-09). API: `GET /audit-logs`.

### 3.14 Configuración

**Puntaje (`/settings/scoring`)** — pesos W_MEMBERS, W_CHILDREN_5, W_ADULTS_65, W_PREGNANT, W_DISABLED, W_ZONE_RISK, W_DAYS_NO_AID, W_DELIVERIES, MAX_DAYS (HU-08 CA5); al guardar invalida caché. API: `GET/PUT /scoring-config`. **Alertas (`/settings/alerts`)** — tabla recurso + umbral. API: `GET/PUT /alert-thresholds`.

---

## 4. Layout Structure

```
+--------------------------------------------------+
| NAVBAR (fixed top)                               |
| [Hamburger] [Logo SIGAH] [ConnectionBadge] [User]|
+----------+---------------------------------------+
| SIDEBAR  |  MAIN CONTENT                         |
| (w-64,   |  <RouterView /> con toasts vue-sonner  |
| collap.) |                                        |
+----------+---------------------------------------+
```

**Sidebar por grupos**: GENERAL (Dashboard, Mapa) · CENSO (Familias, Búsqueda Personas, Zonas, Refugios) · LOGÍSTICA (Bodegas, Inventario, Tipos Recurso, Alertas) · AYUDAS (Entregas, Lote, Planes, Ranking, Donantes, Donaciones) · OPERACIONES (Vectores, Traslados) · ANÁLISIS (Reportes) · CONFIGURACIÓN (admin/coord) · CONTROL (funcionario/admin: Auditoría) · ADMIN (Usuarios).

**ConnectionBadge** (navbar): pill `online`/`offline`/`syncing` + contador de operaciones pendientes (Pinia `useSyncStore`).

**Responsive**: Desktop ≥1024px sidebar visible/colapsable; Tablet 768-1023px slide-over; Mobile <768px overlay, tablas con scroll horizontal. Mobile-first: aprender en <1h (RNF-01).

---

## 5. Routing (Vue Router 5)

```ts
// Protección por navigation guard global (no por componente ProtectedRoute):
//   meta.public === true  -> ruta abierta (login)
//   default               -> requiere JWT
//   password_must_change  -> fuerza /change-password
//   meta.roles?: Role[]    -> autorización por rol (oculta + bloquea)
```

| Ruta | Página (`.vue`) | Notas |
|------|------|-------|
| `/login` | `auth/LoginPage` | sin layout, public |
| `/change-password` | `auth/ChangePasswordPage` | guard `password_must_change` |
| `/dashboard` | `dashboard/DashboardPage` | inicio por rol |
| `/map` | `map/MapPage` | |
| `/families` | `families/FamiliesListPage` | |
| `/families/new` | `families/FamilyFormPage` | offline |
| `/families/:id` | `families/FamilyDetailPage` | |
| `/families/:id/edit` | `families/FamilyFormPage` | edit |
| `/persons/search` | `persons/PersonSearchPage` | |
| `/zones` · `/zones/:id` | `zones/ZonesListPage` · `ZoneDetailPage` | |
| `/shelters` | `shelters/SheltersListPage` | |
| `/warehouses` · `/warehouses/:id` | `warehouses/WarehousesListPage` · `WarehouseDetailPage` | |
| `/inventory/summary` · `/inventory/resource-types` · `/inventory/alerts` | `inventory/*` | |
| `/donors` · `/donors/:id` | `donors/DonorsListPage` · `DonorDetailPage` | |
| `/donations` · `/donations/new` | `donations/DonationsListPage` · `DonationFormPage` | |
| `/deliveries` · `/deliveries/new` · `/deliveries/batch` · `/deliveries/ranking` · `/deliveries/:id` | `deliveries/*` | new offline |
| `/distribution-plans` · `/new` · `/:id` | `distributionPlans/*` | |
| `/reports` · `/reports/coverage` · `/inventory` · `/donations` · `/deliveries-zone` · `/unattended` · `/zones-without-deliveries` · `/traceability` | `reports/*` | |
| `/health/vectors` | `health/HealthVectorsPage` | |
| `/relocations` | `relocations/RelocationsPage` | |
| `/audit` | `audit/AuditLogPage` | FUNCIONARIO_CONTROL/ADMIN |
| `/settings/scoring` · `/settings/alerts` | `settings/*` | ADMIN/COORD |
| `/users` | `users/UsersPage` | ADMIN |
| `/:pathMatch(.*)*` | `NotFoundPage` | |

Total: **40 rutas**, **38 páginas**. Las rutas autenticadas son hijas de `components/layout/AppLayout.vue`.

---

## 6. Componentes compartidos

**Layout**: `AppLayout`, `AppSidebar`, `AppNavbar`, `ConnectionBadge`, `PageHeader` ✅ (base ya scaffoldeada)

**Data display** (`components/ui/`): `DataTable` (vue-table), `KpiCard`, `StatusBadge`, `RiskLevelBadge`, `ProgressBar`, `ScoreBreakdown`, `EmptyState`, `LoadingSpinner`, `Skeleton`

**Forms** (`components/form/`): `FormField`, `SelectField`, `DatePickerField`, `DynamicFieldArray`, `MapPicker`, `PrivacyConsentCheckbox`, `ConfirmDialog`, `ExceptionAuthorizationDialog` (VeeValidate + Zod, Headless UI)

**Map** (`components/map/`): `MapContainer`, `MarkerCluster`, `LayerToggle`, `MarkerPopup`, `ZonesHighlight`

**Auth** (`components/auth/`): `RoleGate` ✅ (renderizado condicional por rol). La protección de rutas vive en los **guards** del router (no en componentes).

**Reportes** (`components/reports/`): `ExportButtons` (PDF/Excel), `ReportHeader`, `ChartContainer`

**Offline**: `OfflineIndicator`, `PendingOpsBadge`, `SyncErrorList`

---

## 7. Role-Based UI (6 roles)

| Capacidad | Admin | Censador | Op.Entregas | Coord.Log | Func.Control | Reg.Donaciones |
|---|---|---|---|---|---|---|
| Registrar familias/personas | ✓ | ✓ | – | ✓ | – | – |
| Editar/desactivar familia | ✓ | ✓ | – | ✓ | – | – |
| Registrar traslado | ✓ | ✓ | – | ✓ | – | – |
| Zonas/refugios/bodegas CRUD | ✓ | – | – | ✓ | – | – |
| Tipos de recurso CRUD | ✓ | – | – | ✓ | – | ✓ |
| Donantes y donaciones | ✓ | – | – | – | consulta | ✓ |
| Plan de distribución | ✓ | – | – | ✓ | – | – |
| Registrar entrega individual | ✓ | – | ✓ | ✓ | – | – |
| Ajuste de inventario | ✓ | – | – | ✓ | – | – |
| Excepción entrega anticipada | ✓ | – | – | ✓ | – | – |
| Vectores CRUD | ✓ | – | – | ✓ | – | – |
| Config puntaje/alertas | ✓ | – | – | ✓ | – | – |
| Auditoría | ✓ | – | – | – | ✓ | – |
| Reportes | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Usuarios CRUD | ✓ | – | – | – | – | – |

Roles (enum): `ADMIN`, `CENSADOR`, `OPERADOR_ENTREGAS`, `COORDINADOR_LOGISTICA`, `FUNCIONARIO_CONTROL`, `REGISTRADOR_DONACIONES`. Los botones y menú items se **ocultan** según rol (no se deshabilitan) vía `RoleGate` / guards. Dashboard como pantalla de inicio varía por rol.

---

## 8. Estructura de proyecto (dentro de `SIGAH/client/`)

> ✅ = ya scaffoldeado y verificado (`pnpm -C client build`).

```
client/
├── index.html                        # #app + /src/main.ts ✅
├── package.json ✅                    # vue-tsc -b && vite build
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json ✅
├── vite.config.ts ✅                  # plugin-vue + tailwind + alias @ + proxy /api
├── eslint.config.js ✅                # eslint + eslint-plugin-vue + ts
├── env.d.ts ✅                        # shims *.vue + vite/client
├── public/
│   ├── favicon.svg ✅ / icons.svg ✅
│   ├── manifest.webmanifest          # PWA manifest (paso 17)
│   ├── icons/                        # PWA icons (192, 512, maskable)
│   └── marker-icons/                 # Leaflet PNGs
└── src/
    ├── main.ts ✅                     # createApp + Pinia + Router + VueQuery
    ├── App.vue ✅                     # <RouterView/> + <Toaster/>
    ├── index.css ✅                   # Tailwind + design tokens (@theme)
    ├── router/
    │   └── index.ts ✅                # rutas + guards (auth, password_must_change)
    ├── stores/                       # Pinia (reemplaza context/)
    │   ├── auth.ts ✅                  # JWT, user, login, hasRole, mustChangePassword
    │   └── sync.ts ✅                  # status online/offline/syncing + pendingCount
    ├── composables/                  # (reemplaza hooks/)
    │   ├── useConnection.ts ✅
    │   ├── useFamilies.ts / useDeliveries.ts / ...   # wrappers vue-query (uno por módulo)
    │   └── useOfflineSync.ts          # consume offlineQueue
    ├── api/
    │   ├── axios.ts ✅                 # baseURL /api/v1, interceptor JWT, 401, idempotent()
    │   ├── auth.api.ts ✅
    │   └── families.api.ts / ...      # uno por módulo (18)
    ├── types/                        # auth.types ✅, api.types ✅, y uno por dominio
    ├── schemas/                      # Zod (family.schema requiere privacy_consent_accepted, ...)
    ├── components/
    │   ├── layout/                    # AppLayout ✅ AppNavbar ✅ AppSidebar ✅ ConnectionBadge ✅
    │   ├── ui/                        # DataTable, KpiCard, StatusBadge, ScoreBreakdown...
    │   ├── form/                      # FormField, MapPicker, PrivacyConsentCheckbox...
    │   ├── map/                       # MapContainer, LayerToggle, ZonesHighlight...
    │   ├── reports/                   # ExportButtons, ChartContainer
    │   └── auth/                      # RoleGate ✅
    ├── pages/                         # una carpeta por módulo (stubs: Login ✅ Dashboard ✅ ...)
    ├── utils/                         # constants ✅, formatters, rolePermissions, mapConfig, exporters
    └── lib/
        ├── queryClient.ts ✅          # TanStack Query (vue) con persist
        ├── leafletSetup.ts
        ├── offlineQueue.ts            # Dexie + cola con client_op_id
        ├── sw.ts                      # Service Worker (workbox)
        └── syncManager.ts             # flush al volver conexión
```

### API Base URL
Axios usa `baseURL: '/api/v1'`. Sin variables de entorno. En dev Vite proxy-a; en prod mismo origen.

---

## 9. Orden de implementación

> El scaffolding (Paso 1) **ya está hecho** en Vue. El backend de cada módulo ya existe.

| Paso | Qué | Frontend deps |
|------|-----|----------------|
| 1 | **Scaffolding Vue (Vite + Vue + Tailwind + Router + Pinia + vue-query + proxy)** ✅ | — |
| 2 | UI base: `DataTable`, `KpiCard`, `StatusBadge`, `ProgressBar`, `FormField`, `SelectField`, `ConfirmDialog`, `ScoreBreakdown` | #1 |
| 3 | Auth completo: `LoginPage` con lockout, `ChangePasswordPage`, `UsersPage` (HU-01/02/03) | #2 |
| 4 | Zonas + Refugios: CRUD con `MapPicker` obligatorio (HU-09/10) | #2-3 |
| 5 | Familias + Personas: form con consentimiento + detalle con breakdown + búsqueda unificada (HU-04/05/06/07) | #3-4 |
| 6 | Bodegas + Inventario: CRUD, ajustes con motivo, alertas, nearest (HU-11/14/15/16/17) | #3 |
| 7 | Donantes + Donaciones: form con enum y contact, items dinámicos (HU-18/19/20) | #6 |
| 8 | Priorización + ScoringConfig: ranking con breakdown, editor de pesos (HU-08) | #5 |
| 9 | Entregas: multi-step, batch, excepciones (HU-22/23/12) | #5-6-8 |
| 10 | Planes de Distribución: wizard, listado, ejecución (HU-21) | #8-9 |
| 11 | Salubridad + Traslados (HU-24/25) | #4 |
| 12 | Mapa con capas (incluye zonas sin entregas) (HU-13/26/30) | #4-6 |
| 13 | Dashboard + Reportes con export + Trazabilidad (HU-27/28/29) | #9-12 |
| 14 | Auditoría con filtros (HU-31) | #3 |
| 15 | **PWA + Offline**: SW, manifest, Dexie queue, ConnectionBadge, flujo offline de censo y entregas | #5-9 |
| 16 | Polish: responsive, error boundaries, loading/empty states, a11y | Todos |

---

## 10. PWA y Offline — detalle

**Service Worker (vite-plugin-pwa + workbox)**: HTML shell NetworkFirst con fallback a cache; assets StaleWhileRevalidate; API GET idempotentes (`/families`, `/inventory/summary`, `/reports/*`) NetworkFirst con cache fallback (TTL 5 min); POST/PUT/DELETE no se cachean, si offline van a la cola Dexie. Manifest: "SIGAH", iconos 192/512/maskable, `display: standalone`.

**Cola offline (Dexie)** — `lib/offlineQueue.ts`:
```ts
interface PendingOp {
  id?: number
  client_op_id: string          // uuid
  entity: 'family' | 'delivery' | 'person' | 'relocation'
  method: 'POST' | 'PUT' | 'DELETE'
  url: string
  payload: unknown
  created_at: Date
  attempts: number
  last_error?: string
}
```

Composable `useOfflineSync()`: al volver online (`window 'online'`) hace flush FIFO contra `POST /sync` (batch) o llamadas individuales con `Idempotency-Key: client_op_id`. Retries con backoff exponencial (máx 5). En conflicto (409) notifica al usuario.

**ConnectionBadge** (Pinia `useSyncStore`): online (verde) · offline (ámbar, "Sin conexión · N pendientes") · syncing (azul, spinner). Click → modal con ops pendientes y errores.

**Flujos offline soportados**: Censo completo con personas y consentimiento (HU-04 CA5); Entrega individual con ítems y ubicación (HU-22 CA6). Lecturas desde cache con indicador "Datos locales".

**Capacidad**: el frontend rechaza guardar más de 200 ops pendientes por usuario.

---

## 11. Verificación

1. **Dev**: `pnpm dev` (raíz) — Express (3000) + Vite (5173). Proxy `/api` funciona.
2. **Build**: `pnpm build` (raíz) → `client/dist/`.
3. **Producción**: `pnpm start` — Express sirve API + frontend.
4. **Auth**: login inválido 5 veces bloquea 15 min; usuario desactivado no entra; `password_must_change` fuerza el cambio antes del dashboard.
5. **CRUD smoke**: por módulo, crear → listar → editar → acción específica.
6. **Consentimiento**: registro de familia sin checkbox bloquea el submit.
7. **Flujo completo**: donación → inventario ↑ → plan priorizado → ejecución → entregas → inventario ↓ → puntaje recalculado → duplicado bloqueado.
8. **Excepción**: coordinador autoriza entrega anticipada con justificación; otros roles no ven el botón.
9. **Mapa**: capas toggle, popups, clustering de familias, zonas sin entregas resaltadas.
10. **Reportes**: cada uno descarga PDF y Excel.
11. **Auditoría**: acciones con before/after e IP; sin UPDATE/DELETE expuestos.
12. **Offline**: desconectar → registrar familia/entrega → ConnectionBadge "N pendientes" → reconectar → sincroniza sin duplicar (Idempotency-Key).
13. **Responsive**: 1440 / 768 / 375 — sidebar colapsa, tablas scroll, formularios full-width.
14. **Roles (6)**: login por rol → menú y acciones coinciden con §7.
15. **Performance**: búsqueda de familias con 12.000 registros < 2s (RNF-04).
16. **Dashboard por rol**: inicio `/dashboard` para COORDINADOR_LOGISTICA y FUNCIONARIO_CONTROL (HU-27 CA3).
