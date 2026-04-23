# SIGAH Frontend Plan

## Context

El frontend es una **SPA React mobile-first y PWA offline-capable** que vive en el monolito bajo `SIGAH/client/` y consume la API definida en PLAN.md (18 módulos, 22 tablas, 44 RF, 10 RN, 31 HU). El 90% del trabajo de campo se hace desde smartphone, por lo que la experiencia móvil es prioritaria. El sistema debe funcionar con conectividad pobre o nula: censo y entregas se guardan localmente en IndexedDB y se sincronizan al recuperar conexión.

En producción, Express sirve el bundle compilado y la API. En desarrollo, Vite proxy-a `/api` al backend (3000).

---

## 1. Tech Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Build | Vite 8.x | HMR rápido, zero-config React + TS |
| UI | React 19.x | Estándar industria |
| Lenguaje | TypeScript strict (TSX) | Type safety total |
| Routing | React Router 7.x | Layouts anidados, route guards |
| Server state | TanStack Query 5.x | Caching, persistencia, reintentos offline |
| Client state | React Context + useReducer | Auth y SyncContext (sin Redux) |
| Styling | TailwindCSS 4.x | Utility-first, responsive, mobile-first |
| Accessible UI | Headless UI 2.x | Modales, dropdowns |
| Forms | TanStack Form 1.x + Zod 4.x | Validación type-safe |
| Tablas | TanStack Table 8.x | Headless sort/paginación |
| Charts | Recharts 3.x | Dashboard y reportes |
| Mapas | React Leaflet 5.x + Leaflet 1.9 | OSM gratis, clustering, markers |
| HTTP | Axios 1.x | Interceptor JWT, 401 handler, Idempotency-Key |
| Íconos | Lucide React | Tree-shakable |
| Toasts | Sonner 2.x | Notificaciones minimalistas |
| Fechas | date-fns 4.x | Formateo ligero |
| **PWA** | **vite-plugin-pwa + workbox-window** | Service Worker, manifest, offline shell |
| **IndexedDB** | **dexie 4.x** | Cola de operaciones offline |
| **Persist cache** | **@tanstack/react-query-persist-client** | Cache de query entre sesiones |
| **Exports** | **jspdf + jspdf-autotable, xlsx, file-saver** | Descargar reportes en PDF/Excel |

---

## 2. Módulos frontend (15 → 18 APIs backend)

| # | Módulo | APIs backend | Responsabilidad |
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
| 11 | Vectores Sanitarios | `/health/vectors` | CRUD con estado |
| 12 | Traslados | `/relocations` | Relocalización de familias |
| 13 | Mapa | `/map` | Visualización geoespacial con capas |
| 14 | Auditoría | `/audit` | Historial inmutable (FUNCIONARIO_CONTROL/ADMIN) |
| 15 | Configuración | `/scoring-config`, `/alert-thresholds` | Pesos del puntaje y umbrales editables |

---

## 3. Vistas (páginas de la app)

### 3.0 Auth

#### Login (`/login`)
- Card centrado full-page, sin navbar/sidebar.
- Form: Email, Contraseña, botón "Iniciar sesión".
- Si `locked_until` está activo: mensaje "Cuenta bloqueada, intenta en X:XX" con cuenta regresiva (HU-02 CA5).
- Si `password_must_change=true`: redirige a `/change-password` obligatorio antes de `/dashboard`.
- Guarda JWT en localStorage.
- **API**: `POST /auth/login`

#### Cambiar contraseña (`/change-password` modal o página)
- Campos: Contraseña actual, Nueva contraseña, Confirmar (mínimo 8 caracteres).
- Obligatorio cuando `password_must_change=true`.
- **API**: `PUT /auth/change-password`

#### Usuarios (`/users`) — solo ADMIN
- Tabla: Nombre, Email, Rol, Estado (activo/desactivado), Último acceso, Acciones.
- Botón "Registrar Usuario" → modal: Nombre completo, Email, Rol (6 opciones), se genera contraseña temporal.
- Acciones por fila: Editar rol, Activar/Desactivar (no eliminar), Resetear contraseña temporal.
- **APIs**: `POST /auth/register`, `PUT /auth/users/:id`, `POST /auth/reset-password/:id`, `GET /auth/users`

---

### 3.1 Dashboard (`/dashboard`)

Pantalla de inicio para COORDINADOR_LOGISTICA y FUNCIONARIO_CONTROL (HU-27 CA3).

**Row 1 — 6 KPI cards** (cada uno enlaza a su listado):
- Total familias registradas
- Familias atendidas (% barra)
- Familias pendientes (rojo si >0)
- Entregas realizadas hoy
- Peso almacenado vs capacidad (kg, barra)
- Alertas activas (badge rojo si >0) → enlaza a `/inventory/alerts` y `/audit`

**Row 2** — Bar chart "Entregas por Zona" | Pie "Donaciones por Tipo"

**Row 3** — Line "Entregas últimos 30 días" | Horizontal bar "Inventario por Categoría"

**Row 4 — Recent Deliveries**: Código, Familia, Zona, Fecha, Estado, Días de cobertura.

**APIs**: `GET /reports/dashboard`, `/reports/coverage`, `/reports/deliveries-by-zone`, `/reports/donations-by-type`, `/reports/unattended-families`, `/inventory/alerts`

---

### 3.2 Familias y Personas

#### Lista (`/families`)
- Search unificada: código FAM / documento / dirección (HU-06 CA1).
- Filtros: Zona, Estado (activo/en_refugio/evacuado), Refugio.
- Columnas: Código, Documento, Zona, Refugio, Miembros, Niños<5, Puntaje, Estado, Última entrega, Acciones.
- Botón "Registrar Familia" (offline-capable).
- Paginación 20/página.
- **API**: `GET /families?q=X&zone_id=&status=&shelter_id=`

#### Formulario (`/families/new`, `/families/:id/edit`)
Mobile-first, funciona sin conexión (HU-04 CA4-5).

- **Básico**: código auto, documento representante, zona (select), refugio (select filtrado), estado, dirección.
- **Composición**: miembros, niños<5, adultos>65, gestantes, discapacitados.
- **Ubicación (opcional)**: latitud, longitud, mapa con marker arrastrable.
- **✅ Checkbox obligatorio**: "Acepto el aviso de privacidad conforme a la Ley 1581/2012" con link al texto. No permite guardar si no está marcado (RN-09).
- Si offline: toast "Guardado localmente, se sincronizará al recuperar conexión".
- **API**: `POST /families` (con `privacy_consent_accepted=true`) / `PUT /families/:id`

#### Detalle (`/families/:id`)
- Header: código, estado badge, puntaje, zona, refugio, dirección.
- **Card "Puntaje de Prioridad"**: valor total + desglose por factor (HU-08 CA2) — miembros, niños<5, adultos>65, gestantes, discapacidad, riesgo zona, días sin ayuda, entregas recibidas.
- **Tab Miembros**: tabla (Nombre, Documento, Edad, Parentesco, Condiciones especiales, Medicación) + botón "Agregar Miembro".
- **Tab Historial entregas**: Código, Fecha, Bodega, Ítems, Días cobertura, Estado.
- **Tab Elegibilidad**: card con elegible sí/no, razón, días desde última entrega, cobertura restante.
- Mini-mapa con ubicación si hay coordenadas.
- **APIs**: `GET /families/:id`, `/families/:id/persons`, `/families/:id/deliveries`, `/families/:id/eligibility`

#### Búsqueda de personas (`/persons/search`)
- Input por documento.
- Muestra card: Nombre, Documento, Familia (link), Fecha nacimiento, Condiciones.
- **API**: `GET /persons/search?document=X`

---

### 3.3 Zonas

#### Lista (`/zones`)
- Grid de cards: nombre, nivel de riesgo (badge por color), población estimada, counts (familias, refugios, bodegas).
- Botón "Agregar Zona".

#### Form (modal)
- Campos: nombre, nivel de riesgo, población, latitud, longitud.

#### Detalle (`/zones/:id`)
- Header + Tabs (Familias, Refugios, Bodegas) + mini-mapa.

---

### 3.4 Refugios (`/shelters`)

- Tabla: Nombre, Dirección, Zona, Tipo, Capacidad, Ocupación, % (barra: verde <70%, amarillo 70-90%, rojo >90% — HU-10 CA2).
- Filtro por zona.
- Form modal con mapa obligatorio (HU-10 CA5).
- Modal de ocupación (valida max_capacity).

---

### 3.5 Bodegas e Inventario

#### Lista bodegas (`/warehouses`)
- Tabla: Nombre, Dirección, Zona, Capacidad, Peso actual, % uso.
- **Alerta visible al 85% de capacidad** (HU-11 CA3).
- **Bloqueo de ingreso si excede 100%** (HU-11 CA4).

#### Form bodega (modal)
- Campos + **mapa obligatorio** (HU-11 CA2).

#### Detalle bodega (`/warehouses/:id`)
- Tabla inventario con expiraciones resaltadas.
- Acción "Ajustar" → modal con combo motivo (merma/daño/devolución/corrección) + textarea obligatoria (HU-17 CA1-2). Bloquea ajustes que dejen stock negativo (HU-17 CA3).

#### Catálogo recursos (`/inventory/resource-types`)
- CRUD con filtro por categoría. Campo `is_active` en vez de delete (HU-14 CA4).

#### Resumen (`/inventory/summary`)
- Cards por categoría + bar chart stock por recurso.

#### Alertas (`/inventory/alerts`)
- Cards de alertas con severidad.
- **API**: `GET /inventory/alerts`

#### Umbrales (`/settings/alerts`) — ADMIN / COORDINADOR_LOGISTICA
- Tabla configurable: recurso + umbral mínimo (HU-16 CA2).
- **API**: `GET/PUT /alert-thresholds`

---

### 3.6 Donantes y Donaciones

#### Donantes (`/donors`)
- Tabla: Nombre, Tipo (badge por color), Contact, Total donaciones, Acciones.
- Form modal: Nombre, Tipo (5 opciones), Contact (requerido), Tax ID.
- Validación unique (nombre, tipo) — HU-18 CA3.

#### Donaciones (`/donations`)
- Tabla con filtros.
- Form multi-sección con cálculo de peso automático y alerta si excede capacidad de bodega destino.
- **API**: `POST /donations`

---

### 3.7 Entregas

#### Lista (`/deliveries`)
- Tabla con estados: **PROGRAMADA** (gris), **EN_CURSO** (azul), **ENTREGADA** (verde) — RF-29.
- Filtros: zona, estado, rango fechas, bodega.
- Botones "Crear Entrega", "Entrega por Lote".

#### Form entrega (`/deliveries/new`) — multi-step, offline-capable
- **Paso 1 — Familia**: búsqueda, muestra elegibilidad. Si cobertura vigente: bloqueo con mensaje "Faltan X días". Acción "Autorizar excepción" solo para COORDINADOR_LOGISTICA con modal de justificación obligatoria (HU-23 CA5).
- **Paso 2 — Bodega**: select o "más cercana", muestra inventario.
- **Paso 3 — Ítems**: filas dinámicas, cálculo de cobertura automático (0,6 kg/persona/día), alerta si <3 días, input "Recibido por".
- **Paso 4 — Confirmar**: resumen + coordenadas de entrega.
- **Offline**: genera `client_op_id`, guarda en IndexedDB, toast "Guardado, se sincronizará". Axios envía `Idempotency-Key` al sincronizar.
- **API**: `POST /deliveries` (con `Idempotency-Key`)

#### Entrega por lote (`/deliveries/batch`)
- Input: N familias.
- Preview top N priorizadas.
- Selección bodega + paquete estándar.
- **APIs**: `GET /prioritization/next-batch`, `POST /deliveries/batch`

#### Detalle entrega (`/deliveries/:id`)
- Header, cards, tabla ítems, PUT /status, mini-mapa.

#### Ranking de priorización (`/deliveries/ranking`)
- Tabla: Rank, Código, Puntaje (con botón "Ver desglose"), Miembros, Niños<5, Mayores, Gestantes, Discapacidad, Riesgo zona, Días sin ayuda, Entregas recibidas.
- Botón "Recalcular todos" (ADMIN/COORDINADOR_LOGISTICA).

---

### 3.8 Planes de Distribución (`/distribution-plans`) — HU-21

#### Lista
- Tabla: Código PLN, Creado por, Fecha, Estado (PROGRAMADA/EN_EJECUCION/COMPLETADA/CANCELADA), Scope, # familias, Acciones.

#### Nuevo plan (`/distribution-plans/new`) — wizard
- **Paso 1 — Scope**: radio GLOBAL / ZONA / REFUGIO / LOTE (+ selector de entidad si no es GLOBAL).
- **Paso 2 — Preview**: tabla de familias elegibles ordenadas por puntaje, asignación por bodega, peso total, alerta "N familias sin atender por falta de stock" (HU-21 CA4).
- **Paso 3 — Confirmar**: guarda como PROGRAMADA.
- **APIs**: `POST /distribution-plans`

#### Detalle (`/distribution-plans/:id`)
- Header con estado + botones "Ejecutar" (genera entregas), "Cancelar".
- Tabla de items con familia, bodega, recursos, estado item (PENDIENTE/ENTREGADO/SIN_ATENDER).

---

### 3.9 Reportes (`/reports`)

#### Hub
- Grid de cards para cada reporte.

#### Reportes individuales
Cada uno con **botones "Exportar PDF" y "Exportar Excel"** (HU-28 CA4, HU-29 CA5):

- **Cobertura** (`/reports/coverage`): KPIs + bar chart por zona + tabla.
- **Inventario** (`/reports/inventory`): cards + tabla + stacked bar.
- **Donaciones por tipo** (`/reports/donations`): pie + bar + tabla.
- **Entregas por zona** (`/reports/deliveries-zone`): bar horizontal + tabla.
- **Familias no atendidas** (`/reports/unattended`): alert banner + tabla con enlace "Crear Entrega".
- **Zonas sin entregas** (`/reports/zones-without-deliveries`) — HU-30: tabla + mapa con resaltado visual.
- **Trazabilidad** (`/reports/traceability`) — HU-29: filtros (donante, rango, zona); cadena donante → bodega → entrega → familia.

---

### 3.10 Vectores Sanitarios (`/health/vectors`)
- Tabla: Tipo (literal PDF), Riesgo (badge), Zona/Refugio, Estado (**ACTIVO/EN_ATENCION/RESUELTO** — HU-25 CA2), Acciones tomadas, Fecha, Acciones.
- Filtros por estado, vector_type, zona.
- Acción inline "Cambiar estado" → modal con nueva acción tomada.
- Form modal para alta con mapa con marker arrastrable.
- **APIs**: CRUD `/health/vectors`, `PUT /health/vectors/:id/status`

---

### 3.11 Traslados (`/relocations`)
- Tabla: Familia, Refugio origen, Refugio destino, Tipo, Fecha, Autorizado por.
- Form modal: familia (searchable), origen (auto), destino (select excluyendo origen, valida capacidad), tipo, motivo.
- **API**: `POST /relocations`, `GET /relocations`

---

### 3.12 Mapa (`/map`)

Leaflet full-width centrado en Montería (8.7479, -75.8814), zoom 13.

**Capas (toggle independientes — HU-13 CA2)**:
- Refugios (azul) — popup con ocupación
- Bodegas (verde) — popup con stock
- Familias (naranja, clustered) — popup minimal (sin datos sensibles)
- Vectores (rojo triángulo) — filtra por defecto ACTIVO + EN_ATENCION (HU-26 CA3); iconos por nivel de riesgo
- Entregas recientes (morado, últimos 7 días)
- **Zonas sin entregas** (resaltado visual amarillo — HU-30 CA4)

Filtro de zona y leyenda.

Si una familia no tiene coordenadas, aparece agrupada por zona (HU-13 CA5).

**APIs**: `GET /map/shelters`, `/warehouses`, `/families`, `/vectors`, `/zone/:id`, `/recent-deliveries`, `/zones-without-deliveries`

---

### 3.13 Auditoría (`/audit`) — FUNCIONARIO_CONTROL / ADMIN

- Tabla: Fecha, Usuario, Acción, Módulo, Entidad, ID, IP.
- Columna expandible que muestra `before` / `after` JSON diff.
- Filtros: usuario, módulo, tipo de acción, rango de fechas (HU-31 CA3).
- Export PDF/Excel.
- **Sin mutaciones** (RNF-09).
- **API**: `GET /audit`

---

### 3.14 Configuración

#### Puntaje (`/settings/scoring`) — ADMIN / COORDINADOR_LOGISTICA
- Formulario con campo por peso: W_MEMBERS, W_CHILDREN_5, W_ADULTS_65, W_PREGNANT, W_DISABLED, W_ZONE_RISK, W_DAYS_NO_AID, W_DELIVERIES, MAX_DAYS (HU-08 CA5).
- Al guardar, invalida caché en backend.
- **API**: `GET/PUT /scoring-config`

#### Alertas (`/settings/alerts`) — ADMIN / COORDINADOR_LOGISTICA
- Tabla: recurso + umbral mínimo.
- **API**: `GET/PUT /alert-thresholds`

---

## 4. Layout Structure

```
+--------------------------------------------------+
| NAVBAR (fixed top)                               |
| [Hamburger] [Logo SIGAH] [ConnectionBadge] [User]|
+----------+---------------------------------------+
| SIDEBAR  |  MAIN CONTENT                         |
| (w-64,   |  <Outlet /> con toasts Sonner          |
| collap.) |                                        |
+----------+---------------------------------------+
```

**Sidebar por grupos**:
- GENERAL: Dashboard, Mapa
- CENSO: Familias, Búsqueda Personas, Zonas, Refugios
- LOGÍSTICA: Bodegas, Inventario, Tipos Recurso, Alertas
- AYUDAS: Entregas, Entrega por Lote, Planes de Distribución, Ranking, Donantes, Donaciones
- OPERACIONES: Vectores, Traslados
- ANÁLISIS: Reportes
- CONFIGURACIÓN (admin/coord): Puntaje, Umbrales
- CONTROL (funcionario/admin): Auditoría
- ADMIN (admin only): Usuarios

**ConnectionBadge** (siempre visible en navbar): pill con estado `online` / `offline` / `syncing` + contador de operaciones pendientes.

**Responsive**:
- Desktop (≥1024px): sidebar visible, collapsible a íconos.
- Tablet (768-1023px): sidebar oculto, slide over.
- Mobile (<768px): overlay full, bottom-nav opcional en flujos de censo/entrega, tables scroll horizontal.

Mobile-first: un voluntario debe aprender a usarlo en <1 hora (RNF-01).

---

## 5. Routing

```
/login                                 LoginPage (sin layout)
/change-password                       ChangePasswordPage (si password_must_change)
/dashboard                             DashboardPage
/map                                   MapPage

/families                              FamiliesListPage
/families/new                          FamilyFormPage (offline-capable)
/families/:id                          FamilyDetailPage
/families/:id/edit                     FamilyFormPage (edit)
/persons/search                        PersonSearchPage

/zones                                 ZonesListPage
/zones/:id                             ZoneDetailPage

/shelters                              SheltersListPage

/warehouses                            WarehousesListPage
/warehouses/:id                        WarehouseDetailPage
/inventory/summary                     InventorySummaryPage
/inventory/resource-types              ResourceTypesPage
/inventory/alerts                      InventoryAlertsPage

/donors                                DonorsListPage
/donations                             DonationsListPage
/donations/new                         DonationFormPage

/deliveries                            DeliveriesListPage
/deliveries/new                        DeliveryFormPage (offline-capable)
/deliveries/batch                      BatchDeliveryPage
/deliveries/ranking                    PriorityRankingPage
/deliveries/:id                        DeliveryDetailPage

/distribution-plans                    DistributionPlansListPage
/distribution-plans/new                DistributionPlanFormPage
/distribution-plans/:id                DistributionPlanDetailPage

/reports                               ReportsHubPage
/reports/coverage                      CoverageReportPage
/reports/inventory                     InventoryReportPage
/reports/donations                     DonationsReportPage
/reports/deliveries-zone               DeliveriesByZoneReportPage
/reports/unattended                    UnattendedFamiliesPage
/reports/zones-without-deliveries      ZonesWithoutDeliveriesPage
/reports/traceability                  TraceabilityReportPage

/health/vectors                        HealthVectorsPage
/relocations                           RelocationsPage

/audit                                 AuditLogPage
/settings/scoring                      ScoringConfigPage
/settings/alerts                       AlertThresholdsPage

/users                                 UsersPage (ADMIN only)
*                                      NotFoundPage
```

Total: **40 rutas**, **38 componentes de página**.

---

## 6. Componentes compartidos

**Layout**: AppLayout, Sidebar, Navbar, ConnectionBadge, PageHeader

**Data display**: DataTable (TanStack), KpiCard, StatusBadge, ProgressBar, ScoreBreakdown, EmptyState, LoadingSpinner, Skeleton

**Forms**: FormField, SelectField, DatePickerField, DynamicFieldArray, MapPicker, PrivacyConsentCheckbox, ConfirmDialog, ExceptionAuthorizationDialog

**Map**: MapContainer, MarkerCluster, LayerToggle, MarkerPopup, ZonesHighlight

**Auth**: ProtectedRoute (JWT + role + password_must_change), RoleBoundary, PasswordChangeGuard

**Reportes**: ExportButtons (PDF/Excel), ReportHeader, ChartContainer

**Offline**: OfflineIndicator, PendingOpsBadge, SyncErrorList

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

Los botones y menú items se ocultan según el rol (no se deshabilitan). Dashboard como pantalla de inicio varía por rol.

---

## 8. Estructura de proyecto (dentro de `SIGAH/client/`)

```
client/
├── index.html                        # Con <link rel="manifest">
├── package.json
├── tsconfig.json                     # strict
├── vite.config.ts                    # Vite + tailwind + vite-plugin-pwa + proxy /api
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   ├── manifest.webmanifest          # PWA manifest
│   ├── icons/                        # PWA icons (192, 512, maskable)
│   └── marker-icons/                 # Leaflet PNGs
├── src/
│   ├── main.tsx                      # Providers: Query, Router, Auth, Sync
│   ├── App.tsx                       # Routes
│   ├── index.css                     # Tailwind directives
│   ├── vite-env.d.ts
│   │
│   ├── types/                        # Tipos compartidos
│   │   ├── auth.types.ts             # User, Role (6 valores), tokens
│   │   ├── family.types.ts           # Status: ACTIVO/EN_REFUGIO/EVACUADO
│   │   ├── zone.types.ts
│   │   ├── shelter.types.ts
│   │   ├── warehouse.types.ts
│   │   ├── donation.types.ts         # DonorType (5 valores nuevos)
│   │   ├── delivery.types.ts         # Status: PROGRAMADA/EN_CURSO/ENTREGADA
│   │   ├── distributionPlan.types.ts
│   │   ├── health.types.ts           # VectorStatus
│   │   ├── relocation.types.ts
│   │   ├── report.types.ts
│   │   ├── audit.types.ts
│   │   ├── scoring.types.ts
│   │   ├── offline.types.ts          # PendingOp, SyncStatus
│   │   ├── map.types.ts
│   │   └── api.types.ts
│   │
│   ├── api/                          # Axios + funciones por módulo (18)
│   │   ├── axios.ts                  # baseURL: /api/v1, interceptor JWT, 401 handler, Idempotency-Key
│   │   ├── auth.api.ts
│   │   ├── families.api.ts
│   │   ├── persons.api.ts
│   │   ├── zones.api.ts
│   │   ├── shelters.api.ts
│   │   ├── warehouses.api.ts
│   │   ├── inventory.api.ts
│   │   ├── donors.api.ts
│   │   ├── donations.api.ts
│   │   ├── deliveries.api.ts
│   │   ├── distributionPlans.api.ts
│   │   ├── prioritization.api.ts
│   │   ├── scoringConfig.api.ts
│   │   ├── reports.api.ts
│   │   ├── healthVectors.api.ts
│   │   ├── relocations.api.ts
│   │   ├── map.api.ts
│   │   ├── audit.api.ts
│   │   └── sync.api.ts
│   │
│   ├── hooks/                        # TanStack Query wrappers
│   │   ├── useAuth.ts
│   │   ├── useFamilies.ts
│   │   ├── usePersons.ts
│   │   ├── useZones.ts
│   │   ├── useShelters.ts
│   │   ├── useWarehouses.ts
│   │   ├── useInventory.ts
│   │   ├── useDonors.ts
│   │   ├── useDonations.ts
│   │   ├── useDeliveries.ts
│   │   ├── useDistributionPlans.ts
│   │   ├── usePrioritization.ts
│   │   ├── useScoringConfig.ts
│   │   ├── useReports.ts
│   │   ├── useHealthVectors.ts
│   │   ├── useRelocations.ts
│   │   ├── useMap.ts
│   │   ├── useAudit.ts
│   │   ├── useOfflineSync.ts         # Hook que consume offlineQueue
│   │   └── useConnection.ts          # Online/offline
│   │
│   ├── context/
│   │   ├── AuthContext.tsx           # JWT + user (incl. password_must_change) + login/logout
│   │   └── SyncContext.tsx           # { status, pendingCount, lastSyncAt }
│   │
│   ├── schemas/                      # Zod schemas
│   │   ├── auth.schema.ts            # password min 8
│   │   ├── family.schema.ts          # requiere privacy_consent_accepted
│   │   ├── person.schema.ts
│   │   ├── ...                       # Uno por módulo
│   │
│   ├── components/
│   │   ├── layout/                   # AppLayout, Sidebar, Navbar, ConnectionBadge, PageHeader
│   │   ├── ui/                       # DataTable, KpiCard, StatusBadge, ScoreBreakdown
│   │   ├── form/                     # FormField, MapPicker, PrivacyConsentCheckbox, etc.
│   │   ├── map/                      # MapContainer, MarkerCluster, LayerToggle, ZonesHighlight
│   │   ├── reports/                  # ExportButtons, ChartContainer
│   │   └── auth/                     # ProtectedRoute, RoleBoundary, PasswordChangeGuard
│   │
│   ├── pages/                        # Una carpeta por módulo
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── families/
│   │   ├── persons/
│   │   ├── zones/
│   │   ├── shelters/
│   │   ├── warehouses/
│   │   ├── inventory/
│   │   ├── donors/
│   │   ├── donations/
│   │   ├── deliveries/
│   │   ├── distributionPlans/
│   │   ├── reports/
│   │   ├── health/
│   │   ├── relocations/
│   │   ├── audit/
│   │   ├── settings/
│   │   ├── users/
│   │   └── map/
│   │
│   ├── utils/
│   │   ├── constants.ts              # 6 roles, estados, categorías, colores
│   │   ├── formatters.ts
│   │   ├── rolePermissions.ts        # Matriz RBAC
│   │   ├── mapConfig.ts              # Coords Montería, tile URL, marker icons
│   │   └── exporters.ts              # generatePDF, generateXLSX con jspdf/xlsx
│   │
│   └── lib/
│       ├── queryClient.ts            # TanStack Query con persist
│       ├── leafletSetup.ts
│       ├── offlineQueue.ts           # Dexie + cola de mutaciones con client_op_id
│       ├── sw.ts                     # Service Worker config (workbox)
│       └── syncManager.ts            # Flush queue cuando vuelve conexión
```

### API Base URL
Axios usa `baseURL: '/api/v1'`. Sin variables de entorno. En dev, Vite proxy-a. En prod, mismo origen.

---

## 9. Orden de implementación

> El scaffolding (Paso 1) ya está hecho como parte del monolito. El backend de cada módulo debe existir antes de su frontend.

| Paso | Qué | Backend | Frontend deps |
|------|-----|---------|----------------|
| 1 | Scaffolding (Vite + React + Tailwind + folder + proxy) | #1 | — |
| 2 | Adaptación Auth (roles nuevos, password_must_change, lockout) | #9.1 | — |
| 3 | UI base: DataTable, KpiCard, StatusBadge, ProgressBar, FormField, SelectField, ConfirmDialog, ScoreBreakdown | — | #1 |
| 4 | Layout + ProtectedRoute + PasswordChangeGuard | — | #3 |
| 5 | Axios + AuthContext + LoginPage con lockout + ChangePasswordPage + UsersPage | #9.1 | #3-4 |
| 6 | Zonas + Refugios: CRUD con mapa obligatorio | #10-#11 | #5 |
| 7 | Familias + Personas: formulario con consentimiento privacidad + detalle con breakdown de puntaje + búsqueda unificada | #12-#14 | #5-6 |
| 8 | Bodegas + Inventario: CRUD, ajustes con motivo, alertas configurables, nearest | #15-#17 | #5 |
| 9 | Donantes + Donaciones: form con nuevo enum y contact, items dinámicos | #18-#19 | #8 |
| 10 | Priorización + ScoringConfig: ranking con breakdown, editor de pesos | #20-#21 | #7 |
| 11 | Entregas: multi-step, batch, excepciones (sin offline aún) | #22-#24 | #7-8-10 |
| 12 | Planes de Distribución: wizard, listado, ejecución | #25 | #10-11 |
| 13 | Salubridad + Traslados | #26-#27 | #5 |
| 14 | Mapa con capas (incluye zonas sin entregas) | #29 | #6-8 |
| 15 | Dashboard + Reportes con export PDF/Excel + Trazabilidad | #30-#31 | #11-14 |
| 16 | Auditoría UI con filtros | #28 | #5 |
| 17 | **PWA + Offline**: Service Worker, manifest, Dexie queue, ConnectionBadge, offline flow de censo y entregas | #32 | #7-11 |
| 18 | Polish: responsive, error boundaries, loading/empty states, a11y | Todos | Todos |

---

## 10. PWA y Offline — detalle

### Service Worker (vite-plugin-pwa + workbox)
- Estrategia por tipo de recurso:
  - HTML shell: NetworkFirst con fallback a cache.
  - Assets (JS/CSS/IMG): StaleWhileRevalidate.
  - API GET idempotentes (`/families`, `/inventory/summary`, `/reports/*`): NetworkFirst con cache fallback (TTL 5 min).
  - API POST/PUT/DELETE: **no cachear**; si offline, el request va a la cola (Dexie).
- Manifest: nombre "SIGAH", iconos 192/512/maskable, `start_url: '/'`, `display: 'standalone'`.

### Cola offline (Dexie)
```ts
// lib/offlineQueue.ts
interface PendingOp {
  id?: number;
  client_op_id: string;        // uuid
  entity: 'family' | 'delivery' | 'person' | 'relocation';
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  payload: unknown;
  created_at: Date;
  attempts: number;
  last_error?: string;
}
```

Hook `useOfflineSync()`:
- Al volver online (`window.addEventListener('online')`): hace flush en orden FIFO contra `/sync` batch o llamadas individuales con `Idempotency-Key: client_op_id`.
- Retries con backoff exponencial (max 5 intentos).
- En caso de conflicto (409), notifica al usuario para resolver.

### ConnectionBadge (navbar)
- **Online** (verde): sin pendientes.
- **Offline** (amarillo): muestra "Sin conexión · N pendientes".
- **Syncing** (azul con spinner): durante flush.
- Click → modal con detalle de ops pendientes y errores.

### Flujos offline soportados
- **Censo** (HU-04 CA5): registrar familia completa con personas y consentimiento. Se guarda con `client_op_id`; sincroniza al reconectar.
- **Entregas** (HU-22 CA6): registrar entrega individual con ítems y ubicación.
- Lecturas (listas, detalles) disponibles desde cache con indicador "Datos locales, pueden estar desactualizados".

### Consideraciones de capacidad
- IndexedDB: sin límite práctico para el uso esperado.
- El frontend rechaza guardar más de 200 ops pendientes por usuario (protección).

---

## 11. Verificación

1. **Dev**: `npm run dev` desde la raíz — Express (3000) + Vite (5173) concurrentes. Proxy /api funciona.
2. **Build**: `npm run build` — genera `client/dist/`.
3. **Producción**: `npm start` — Express sirve API + frontend.
4. **Auth**:
   - Login inválido 5 veces bloquea la cuenta 15 minutos.
   - Usuario desactivado no entra.
   - `password_must_change=true` fuerza flujo de cambio antes del dashboard.
5. **CRUD smoke test**: por cada módulo, crear → listar → editar → acción específica.
6. **Consentimiento privacidad**: registro de familia sin checkbox debe bloquear el submit.
7. **Flujo completo**: donación → inventario incrementado → plan de distribución priorizado → ejecución → entregas creadas → inventario decrementado → priority_score recalculado → intento duplicado bloqueado.
8. **Excepción**: coordinador autoriza entrega anticipada con justificación obligatoria; otros roles no ven el botón.
9. **Mapa**: todas las capas toggle on/off, markers con popups correctos, clustering de familias, zonas sin entregas resaltadas.
10. **Reportes**: cada reporte descarga PDF y Excel correctos.
11. **Auditoría**: acciones aparecen en `/audit` con before/after y IP; UPDATE/DELETE directos no están expuestos.
12. **Offline**:
    - Desconectar red. Registrar familia. ConnectionBadge muestra "1 pendiente". Reconectar. Se sincroniza y aparece en lista.
    - Misma prueba con entrega.
    - Intento de sincronizar la misma op dos veces (tras reinstalar app): no duplica por Idempotency-Key.
13. **Responsive**: probar 1440px, 768px, 375px — sidebar colapsa, tablas scroll, formularios full-width en mobile.
14. **Roles (6 matrices)**: login con cada rol → verificar que el menú y las acciones coinciden con la tabla §7.
15. **Performance**: búsqueda de familias con 12.000 registros responde en <2s.
16. **Dashboard por rol**: pantalla de inicio es `/dashboard` para COORDINADOR_LOGISTICA y FUNCIONARIO_CONTROL (HU-27 CA3).
