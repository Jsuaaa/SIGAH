# SIGAH Frontend Plan

## Context

The SIGAH backend (PLAN.md) defines 14 REST API modules, 16 database tables, and business rules for managing humanitarian aid after the 2026 Monteria flood. This plan defines the complete frontend that consumes that API: every module, every view, every field, and the architecture to tie it together.

---

## 1. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Build | Vite 6.x | Fast HMR, zero-config React + TS support |
| UI | React 19.x | Industry standard, massive ecosystem |
| Language | TypeScript (TSX) | Type safety across components, hooks, API layer, and form schemas |
| Routing | React Router 7.x | Nested layouts, route guards |
| Server state | TanStack Query 5.x | Caching, refetching, loading/error states for all API calls |
| Client state | React Context + useReducer | Auth only — no Redux needed |
| Styling | TailwindCSS 4.x | Utility-first, responsive by default |
| Accessible UI | Headless UI 2.x | Modals, dropdowns, dialogs |
| Forms | TanStack Form 1.x + Zod 3.x | Type-safe form state with `@tanstack/zod-form-adapter` for schema validation |
| Tables | TanStack Table 8.x | Headless sortable/paginated tables |
| Charts | Recharts 2.x | Simple React charting (bar, pie, line) |
| Maps | React Leaflet 5.x + Leaflet 1.9 | Free OSM tiles, markers, popups, clustering |
| HTTP | Axios 1.x | JWT interceptor, 401 handler |
| Icons | Lucide React | Clean, tree-shakable icons |
| Toasts | Sonner 1.x | Minimal notification toasts |
| Dates | date-fns 3.x | Lightweight date formatting |

---

## 2. Modules (12 frontend modules → 14 backend APIs)

| # | Module | Backend APIs | Responsibility |
|---|--------|-------------|----------------|
| 1 | Auth | `/auth` | Login, session, password change, user management |
| 2 | Dashboard | `/reports/dashboard`, `/inventory/alerts` | KPIs and charts |
| 3 | Families & Persons | `/families`, `/persons`, `/prioritization` | Census CRUD, priority scores |
| 4 | Zones | `/zones` | Zone CRUD + detail with families/shelters/warehouses |
| 5 | Shelters | `/shelters` | Shelter CRUD + occupancy |
| 6 | Warehouses & Inventory | `/warehouses`, `/resource-types`, `/inventory` | Warehouse CRUD, stock, alerts |
| 7 | Donors & Donations | `/donors`, `/donations` | Donor registry, donation recording |
| 8 | Deliveries | `/deliveries`, `/prioritization` | Individual/batch delivery, status, ranking |
| 9 | Reports | `/reports` | Coverage, inventory, donations, deliveries, unattended |
| 10 | Health Vectors | `/health/vectors` | Sanitary vector CRUD |
| 11 | Relocations | `/relocations` | Family relocation management |
| 12 | Map | `/map` | Interactive map with all geolocated entities |

---

## 3. Views (every page in the app)

### 3.0 Auth Module

#### Login Page (`/login`)
- Full-page centered card, no sidebar/navbar
- Form: Email, Password, "Login" button
- Error toast on invalid credentials
- On success: store JWT in localStorage, redirect to `/dashboard`
- **API**: `POST /auth/login`

#### Change Password (modal from navbar user menu)
- Fields: Current password, New password, Confirm new password
- **API**: `PUT /auth/change-password`

#### User Management (`/users`) — admin only
- Table: Email, Role, Created At, Actions
- "Register User" button → modal: Email, Password, Role select (admin/coordinator/operator/viewer)
- **API**: `POST /auth/register`

---

### 3.1 Dashboard (`/dashboard`)

**Row 1 — 6 KPI cards:**
- Total families registered
- Families attended (count + % bar)
- Families unattended (red if > 0)
- Total deliveries made
- Inventory weight (current/capacity kg, progress bar)
- Active inventory alerts (red badge if > 0)

**Row 2 — 2 charts:**
- Bar chart: "Deliveries by Zone" (zone names × delivery count)
- Pie chart: "Donations by Type" (in_kind/monetary/mixed)

**Row 3 — 2 charts:**
- Line chart: "Deliveries over time" (last 30 days)
- Horizontal bar: "Inventory by Category" (food/shelter/hygiene/health)

**Row 4 — mini table:**
- "Recent Deliveries" (last 10): Family Code, Zone, Date, Status, Coverage Days

**APIs**: `GET /reports/dashboard`, `/reports/coverage`, `/reports/deliveries-by-zone`, `/reports/donations-by-type`, `/reports/unattended-families`, `/inventory/alerts`

---

### 3.2 Families & Persons

#### Families List (`/families`)
- Search bar: filter by family_code or head_document
- Filters: Zone dropdown, Status (active/inactive/relocated), Shelter dropdown
- Table columns: Family Code, Head Document, Zone, Shelter, Members, Children <5, Priority Score, Status, Last Delivery, Actions (View/Edit/Delete)
- "Register Family" button
- Pagination: 20 per page
- **API**: `GET /families`

#### Family Form (`/families/new`, `/families/:id/edit`)
- **Basic Info**: Family Code (auto, read-only), Head Document, Zone (select), Shelter (select filtered by zone), Status, Reference Address
- **Composition**: Members count, Children <5, Adults >65, Pregnant, Disabled
- **Location** (optional): Latitude, Longitude, embedded map with draggable marker (MapPicker)
- **API**: `POST /families` or `PUT /families/:id`

#### Family Detail (`/families/:id`)
- Header card: Code, status badge, priority score, zone, shelter, address
- **Tab 1 — Members**: table (Name, Document, Birth Date, Gender, Relationship, Special Conditions, Requires Medication) + "Add Member" button → modal with person form
- **Tab 2 — Delivery History**: table (Delivery Code, Date, Warehouse, Items, Coverage Days, Status)
- **Tab 3 — Eligibility**: card with eligible yes/no, reason, days since last delivery, coverage remaining
- Mini-map with family location marker (if coordinates exist)
- **APIs**: `GET /families/:id`, `/families/:id/persons`, `/families/:id/deliveries`, `/families/:id/eligibility`

#### Person Search (`/persons/search`)
- Search input by document number
- Displays person card: Name, Document, Family Code (link), Birth Date, Gender, Special Conditions
- **API**: `GET /persons/search?document=X`

---

### 3.3 Zones

#### Zones List (`/zones`)
- Card grid (not table) — each zone card shows:
  - Zone name, risk level badge (green/yellow/orange/red), estimated population
  - Counts: families, shelters, warehouses
- "Add Zone" button
- **API**: `GET /zones`

#### Zone Form (modal)
- Fields: Name, Risk Level (select: low/medium/high/critical), Estimated Population, Latitude, Longitude
- **API**: `POST /zones` or `PUT /zones/:id`

#### Zone Detail (`/zones/:id`)
- Header: name, risk badge, population, coordinates
- **Tab Families**: table (Family Code, Members, Priority Score, Status)
- **Tab Shelters**: table (Name, Capacity, Occupancy %)
- **Tab Warehouses**: table (Name, Capacity, Current Weight %)
- Mini-map with all zone entities
- **APIs**: `GET /zones/:id/families`, `/zones/:id/shelters`, `/zones/:id/warehouses`, `/map/zone/:id`

---

### 3.4 Shelters

#### Shelters List (`/shelters`)
- Table: Name, Address, Zone, Type, Max Capacity, Current Occupancy, Occupancy % (colored progress bar: green <70%, yellow 70-90%, red >90%), Actions
- Filter: Zone dropdown
- "Add Shelter" button
- **API**: `GET /shelters`

#### Shelter Form (modal)
- Fields: Name, Address, Zone (select), Type (school/sports_center/church/community_center/other), Max Capacity, Latitude, Longitude, embedded map with draggable marker
- **API**: `POST /shelters` or `PUT /shelters/:id`

#### Update Occupancy (inline quick modal)
- Current occupancy number input (max = max_capacity)
- **API**: `PUT /shelters/:id/occupancy`

---

### 3.5 Warehouses & Inventory

#### Warehouses List (`/warehouses`)
- Table: Name, Address, Zone, Max Capacity (kg), Current Weight (kg), Usage % (progress bar), Status, Actions
- Filters: Zone, Status (active/inactive)
- "Add Warehouse" button
- **API**: `GET /warehouses`

#### Warehouse Form (modal)
- Fields: Name, Address, Zone (select), Max Capacity kg, Status (active/inactive), Latitude, Longitude, embedded map
- **API**: `POST /warehouses` or `PUT /warehouses/:id`

#### Warehouse Detail (`/warehouses/:id`)
- Header card: name, address, zone, capacity bar (current/max kg), status badge
- Inventory table: Resource Type, Category, Unit, Available Quantity, Total Weight (kg), Batch, Expiration Date, Actions
  - Rows with expiration within 7 days: yellow highlight
  - Rows with expired items: red highlight
  - Action: "Adjust" → opens adjustment modal
- **API**: `GET /warehouses/:id/inventory`

#### Inventory Adjustment Modal
- Fields: Resource Type (read-only), Adjustment Type (add/subtract), Quantity, Reason (textarea)
- **API**: `PUT /inventory/:id/adjustment`

#### Resource Types Catalog (`/inventory/resource-types`)
- Table: Name, Category, Unit of Measure, Unit Weight (kg), Actions
- Filter: Category dropdown (food/shelter/hygiene/health)
- "Add Resource Type" button → modal: Name, Category (select), Unit of Measure, Unit Weight kg
- **API**: CRUD `/resource-types`

#### Inventory Summary (`/inventory/summary`)
- Cards grouped by category (food, shelter, hygiene, health): total quantity, total weight, resource type count
- Bar chart: stock level per resource type
- **API**: `GET /inventory/summary`

#### Inventory Alerts (`/inventory/alerts`)
- Alert cards with severity icons:
  - Low stock warnings (amber)
  - Expiring items (amber)
  - Expired items (red)
  - Over-capacity warehouses (red)
- Each card: warehouse name, resource type, current quantity, action button → warehouse detail
- **API**: `GET /inventory/alerts`

---

### 3.6 Donors & Donations

#### Donors List (`/donors`)
- Table: Name, Type (badge: city_hall=blue, state_government=purple, private_company=green, citizen=gray, ngo=teal), Tax ID, Total Donations, Actions
- "Register Donor" button
- **API**: `GET /donors`

#### Donor Form (modal)
- Fields: Name, Type (select), Tax ID (optional for citizens)
- **API**: `POST /donors` or `PUT /donors/:id`

#### Donations List (`/donations`)
- Table: Donation Code, Donor Name, Type (in_kind/monetary/mixed), Monetary Amount, Destination Warehouse, Date, Actions
- Filters: Donor, Type, Date range
- "Record Donation" button
- **API**: `GET /donations`

#### Donation Form (`/donations/new`)
- **Section 1 — General**: Donor (searchable select), Donation Type (select), Date (date picker, default today), Destination Warehouse (select, for in_kind/mixed), Monetary Amount (for monetary/mixed)
- **Section 2 — In-kind Items** (if in_kind/mixed): dynamic rows (add/remove):
  - Resource Type (select), Quantity, auto-calculated weight
  - Running total weight at bottom
  - Warning if total would exceed warehouse capacity
- **API**: `POST /donations`

---

### 3.7 Deliveries

#### Deliveries List (`/deliveries`)
- Table: Delivery Code, Family Code, Zone, Source Warehouse, Date, Coverage Days, Status (badge: pending=gray, in_transit=blue, delivered=green, cancelled=red), Delivered By, Actions
- Filters: Zone, Status, Date range, Warehouse
- "Create Delivery" and "Batch Delivery" buttons
- **API**: `GET /deliveries`

#### Delivery Form (`/deliveries/new`) — multi-step
- **Step 1 — Select Family**: search by code/document, show family info + eligibility check result (API: `GET /families/:id/eligibility`)
- **Step 2 — Select Warehouse**: select or "nearest" auto-select, show current inventory (APIs: `GET /warehouses/:id/inventory`, `GET /warehouses/nearest`)
- **Step 3 — Select Items**: dynamic rows (resource type, quantity, weight), auto-calculated coverage days (0.6 kg/person/day), warning if <3 days, "Received By" document input
- **Step 4 — Confirm**: summary card (family, warehouse, items, weight, coverage days), delivery coordinates
- **API**: `POST /deliveries`

#### Batch Delivery (`/deliveries/batch`)
- Input: number of families (N)
- "Preview Batch" → table of N highest-priority families (API: `GET /prioritization/next-batch?count=N`)
- Source warehouse selection, standard item configuration
- "Execute Batch" button
- **API**: `POST /deliveries/batch`

#### Delivery Detail (`/deliveries/:id`)
- Header: code, status badge, date, coverage days
- Cards: family info, warehouse info, delivered by
- Items table: Resource Type, Quantity, Weight
- Status update dropdown (coordinator/admin)
- Mini-map with delivery location
- **APIs**: `GET /deliveries/:id`, `PUT /deliveries/:id/status`

#### Priority Ranking (`/deliveries/ranking`)
- Table: Rank, Family Code, Priority Score, Members, Children <5, Elderly, Pregnant, Disabled, Zone Risk, Days Without Aid, Deliveries Received
- "Recalculate All" button (admin/coordinator)
- **APIs**: `GET /prioritization/ranking`, `POST /prioritization/recalculate`

---

### 3.8 Reports

#### Reports Hub (`/reports`)
- Grid of 5 report cards: title, description, icon, "Generate" button

#### Coverage Report (`/reports/coverage`)
- KPIs: total families, attended, unattended, coverage %
- Bar chart: coverage by zone
- Table: Zone, Total Families, Attended, Unattended, Coverage %
- **API**: `GET /reports/coverage`

#### Inventory Report (`/reports/inventory`)
- Summary cards by category
- Table: Warehouse, Resource Type, Available, Weight, Status
- Stacked bar chart: inventory per warehouse
- **API**: `GET /reports/inventory`

#### Donations Report (`/reports/donations`)
- Pie chart: by donation type
- Bar chart: by donor type
- Table: Donor, Type, Total Amount, Donations Count
- **API**: `GET /reports/donations-by-type`

#### Deliveries by Zone (`/reports/deliveries-zone`)
- Horizontal bar chart: deliveries per zone
- Table: Zone, Deliveries Count, Families Covered, Avg Coverage Days
- **API**: `GET /reports/deliveries-by-zone`

#### Unattended Families (`/reports/unattended`)
- Alert banner with total count
- Table: Family Code, Head Document, Zone, Members, Priority Score, Days Since Registration
- Action: "Create Delivery" link per row
- **API**: `GET /reports/unattended-families`

---

### 3.9 Health Vectors (`/health/vectors`)
- Table: Vector Type, Risk Level (badge), Zone/Shelter, Lat, Lng, Actions Taken, Date, Actions
- "Register Vector" button → modal: Vector Type (mosquito/rodent/contaminated_water/waste/other), Risk Level, Zone/Shelter (optional), Lat, Lng, map with draggable marker, Actions Taken (textarea)
- **API**: CRUD `/health/vectors`

---

### 3.10 Relocations (`/relocations`)
- Table: Family Code, Origin Shelter, Destination Shelter, Type (temporary/permanent), Date, Created By
- "Register Relocation" button → modal: Family (searchable select), Origin Shelter (auto from family, read-only), Destination Shelter (select, excluding origin), Type, Reason
- **API**: `POST /relocations`, `GET /relocations`

---

### 3.11 Map (`/map`)
- Full-width Leaflet map centered on Monteria (8.7479, -75.8814), zoom 13
- **Layer toggles** (floating checkbox panel):
  - Shelters (blue markers, popup: name, occupancy/capacity, "View Detail" link)
  - Warehouses (green markers, popup: name, weight/capacity, "View Inventory" link)
  - Families (orange dots, clustered with react-leaflet-cluster, popup: code, priority, status)
  - Health Vectors (red triangle markers, popup: type, risk, actions)
  - Recent Deliveries (purple markers, popup: family code, date, items)
- Zone filter dropdown
- Color-coded legend
- **APIs**: `GET /map/shelters`, `/map/warehouses`, `/map/families`, `/map/vectors`, `/map/zone/:id`, `/map/recent-deliveries`

---

## 4. Layout Structure

```
+--------------------------------------------------+
| NAVBAR (fixed top)                               |
| [Hamburger] [SIGAH Logo]          [Alerts] [User]|
+----------+---------------------------------------+
| SIDEBAR  |  MAIN CONTENT                         |
| (w-64,   |  (scrollable, padded)                 |
| collaps- |                                        |
| ible)    |  <Outlet /> (React Router)             |
|          |                                        |
| Nav      |                                        |
| groups:  |                                        |
| GENERAL  |                                        |
| CENSUS   |                                        |
| LOGISTICS|                                        |
| AID      |                                        |
| OPERATIONS                                        |
| ANALYSIS |                                        |
| ADMIN    |                                        |
+----------+---------------------------------------+
```

**Sidebar nav groups:**
- GENERAL: Dashboard, Map
- CENSUS: Families, Person Search, Zones, Shelters
- LOGISTICS: Warehouses, Inventory, Resource Types, Alerts
- AID: Deliveries, Batch Delivery, Priority Ranking, Donors, Donations
- OPERATIONS: Health Vectors, Relocations
- ANALYSIS: Reports
- ADMIN (admin only): Users

**Responsive:** Desktop (>=1024px) sidebar visible, collapsible to icons. Tablet (768-1023px) sidebar hidden, slides over. Mobile (<768px) full overlay, tables scroll horizontally.

---

## 5. Routing

```
/login                          LoginPage (no layout)
/dashboard                      DashboardPage
/map                            MapPage
/families                       FamiliesListPage
/families/new                   FamilyFormPage
/families/:id                   FamilyDetailPage
/families/:id/edit              FamilyFormPage (edit)
/persons/search                 PersonSearchPage
/zones                          ZonesListPage
/zones/:id                      ZoneDetailPage
/shelters                       SheltersListPage
/warehouses                     WarehousesListPage
/warehouses/:id                 WarehouseDetailPage
/inventory/summary              InventorySummaryPage
/inventory/resource-types       ResourceTypesPage
/inventory/alerts               InventoryAlertsPage
/donors                         DonorsListPage
/donations                      DonationsListPage
/donations/new                  DonationFormPage
/deliveries                     DeliveriesListPage
/deliveries/new                 DeliveryFormPage
/deliveries/batch               BatchDeliveryPage
/deliveries/ranking             PriorityRankingPage
/deliveries/:id                 DeliveryDetailPage
/reports                        ReportsHubPage
/reports/coverage               CoverageReportPage
/reports/inventory              InventoryReportPage
/reports/donations              DonationsReportPage
/reports/deliveries-zone        DeliveriesByZoneReportPage
/reports/unattended             UnattendedFamiliesPage
/health/vectors                 HealthVectorsPage
/relocations                    RelocationsPage
/users                          UsersPage (admin only)
*                               NotFoundPage
```

Total: **32 routes**, **30 page components**

---

## 6. Shared Components

**Layout**: AppLayout, Sidebar, Navbar, PageHeader (title + breadcrumbs + action buttons)

**Data display**: DataTable (TanStack Table wrapper with sorting/pagination/skeleton), KpiCard, StatusBadge, ProgressBar, EmptyState, LoadingSpinner, Skeleton

**Forms** (TanStack Form + Zod): FormField (wraps `form.Field` with label+input+error), SelectField (searchable), DatePickerField, DynamicFieldArray (wraps `form.Field` with `mode: 'array'` for add/remove rows), MapPicker (embedded Leaflet with draggable marker), ConfirmDialog

**Map**: MapContainer (preconfigured Leaflet), MarkerCluster, LayerToggle, MarkerPopup

**Auth**: ProtectedRoute (JWT + role check), RoleBoundary (conditional render by role)

---

## 7. Role-Based UI

| Feature | Admin | Coordinator | Operator | Viewer |
|---------|-------|-------------|----------|--------|
| View all data | Yes | Yes | Yes | Yes |
| Create/edit families, persons | Yes | Yes | Yes | No |
| Delete families, persons | Yes | Yes | No | No |
| Create/edit zones, shelters, warehouses | Yes | Yes | No | No |
| Delete zones, shelters, warehouses | Yes | No | No | No |
| Record donations | Yes | Yes | Yes | No |
| Create deliveries | Yes | Yes | Yes | No |
| Batch delivery | Yes | Yes | No | No |
| Recalculate priorities | Yes | Yes | No | No |
| Register users | Yes | No | No | No |
| Inventory adjustments | Yes | Yes | No | No |
| View reports & map | Yes | Yes | Yes | Yes |

---

## 8. Project Structure

```
sigah-frontend/
├── index.html
├── package.json
├── tsconfig.json                     # TypeScript config (strict mode)
├── tsconfig.node.json                # TS config for Vite/Node files
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .env                              # VITE_API_URL=http://localhost:3000/api/v1
├── .env.example
├── .gitignore
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── marker-icons/                 # Custom Leaflet marker PNGs
├── src/
│   ├── main.tsx                      # ReactDOM.createRoot, providers
│   ├── App.tsx                       # Route definitions
│   ├── index.css                     # Tailwind directives
│   ├── vite-env.d.ts                 # Vite client types
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── auth.types.ts             # User, LoginRequest, LoginResponse, Role
│   │   ├── family.types.ts           # Family, Person, FamilyStatus
│   │   ├── zone.types.ts             # Zone, RiskLevel
│   │   ├── shelter.types.ts          # Shelter, ShelterType
│   │   ├── warehouse.types.ts        # Warehouse, ResourceType, InventoryItem
│   │   ├── donation.types.ts         # Donor, Donation, DonationDetail, DonorType
│   │   ├── delivery.types.ts         # Delivery, DeliveryDetail, DeliveryStatus
│   │   ├── health.types.ts           # HealthVector, VectorType
│   │   ├── relocation.types.ts       # Relocation, RelocationType
│   │   ├── report.types.ts           # Dashboard, CoverageReport, etc.
│   │   ├── map.types.ts              # MapMarker, MapLayer
│   │   └── api.types.ts              # PaginatedResponse<T>, ApiError
│   │
│   ├── api/                          # Axios setup + per-module API functions
│   │   ├── axios.ts                  # Instance with JWT interceptor + 401 handler
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
│   │   ├── prioritization.api.ts
│   │   ├── reports.api.ts
│   │   ├── healthVectors.api.ts
│   │   ├── relocations.api.ts
│   │   └── map.api.ts
│   │
│   ├── hooks/                        # TanStack Query wrappers per module
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
│   │   ├── usePrioritization.ts
│   │   ├── useReports.ts
│   │   ├── useHealthVectors.ts
│   │   ├── useRelocations.ts
│   │   └── useMap.ts
│   │
│   ├── context/
│   │   └── AuthContext.tsx           # JWT + user state + login/logout
│   │
│   ├── schemas/                      # Zod validation schemas (used by TanStack Form)
│   │   ├── auth.schema.ts
│   │   ├── family.schema.ts
│   │   ├── person.schema.ts
│   │   ├── zone.schema.ts
│   │   ├── shelter.schema.ts
│   │   ├── warehouse.schema.ts
│   │   ├── resourceType.schema.ts
│   │   ├── donor.schema.ts
│   │   ├── donation.schema.ts
│   │   ├── delivery.schema.ts
│   │   ├── healthVector.schema.ts
│   │   └── relocation.schema.ts
│   │
│   ├── components/
│   │   ├── layout/                   # AppLayout, Sidebar, Navbar, PageHeader
│   │   ├── ui/                       # DataTable, KpiCard, StatusBadge, etc.
│   │   ├── form/                     # FormField, SelectField, MapPicker, etc.
│   │   ├── map/                      # MapContainer, MarkerCluster, LayerToggle
│   │   └── auth/                     # ProtectedRoute, RoleBoundary
│   │
│   ├── pages/                        # One folder per module, one .tsx per page
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
│   │   ├── reports/
│   │   ├── health/
│   │   ├── relocations/
│   │   ├── users/
│   │   └── map/
│   │
│   ├── utils/
│   │   ├── constants.ts              # Roles, statuses, categories, colors
│   │   ├── formatters.ts             # formatDate, formatWeight, formatPercentage
│   │   ├── rolePermissions.ts        # canCreate/canEdit/canDelete per module
│   │   └── mapConfig.ts              # Monteria coords, zoom, tile URL, marker icons
│   │
│   └── lib/
│       ├── queryClient.ts            # TanStack Query client defaults
│       └── leafletSetup.ts           # Fix Leaflet icon issue with Vite
```

---

## 9. Implementation Order

| Step | What | Depends on |
|------|------|-----------|
| 1 | Project scaffolding: Vite + React + Tailwind + folder structure + .env | — |
| 2 | Shared UI components: DataTable, KpiCard, StatusBadge, ProgressBar, FormField, SelectField, ConfirmDialog | Step 1 |
| 3 | Layout: AppLayout, Sidebar, Navbar, routing with ProtectedRoute | Step 1 |
| 4 | Auth: Axios setup, AuthContext, LoginPage, RoleBoundary, UsersPage | Steps 2-3 |
| 5 | Zones + Shelters: list, CRUD forms, zone detail with tabs | Step 4 |
| 6 | Families + Persons: list, form with MapPicker, detail with tabs, person search | Steps 4-5 |
| 7 | Warehouses + Inventory: CRUD, warehouse detail, resource types, summary, alerts | Step 4 |
| 8 | Donors + Donations: donor CRUD, donation form with dynamic item rows | Step 7 |
| 9 | Deliveries: multi-step form, batch, list, detail, priority ranking | Steps 6-7 |
| 10 | Map: Leaflet setup, layers, clustering, popups | Steps 5-7 |
| 11 | Dashboard: KPI cards, Recharts, recent deliveries table | Steps 6-9 |
| 12 | Reports: 5 report pages with charts and tables | Step 11 |
| 13 | Health Vectors + Relocations: CRUD pages | Step 4 |
| 14 | Polish: responsive testing, error boundaries, loading/empty states | All |

---

## 10. Verification

1. **Dev server**: `npm run dev` — app loads at `localhost:5173`, login page renders
2. **Auth flow**: login with valid credentials → redirected to dashboard; invalid → error toast; expired token → redirected to login
3. **CRUD smoke test**: for each module, create an entity, see it in the list, edit it, delete it
4. **Delivery flow**: create family → check eligibility → select warehouse → add items → verify coverage >= 3 days → confirm → inventory decremented → priority recalculated
5. **Map**: all layers toggle on/off, markers display with correct popups, family markers cluster at zoom out
6. **Reports**: each report renders charts and tables with real data
7. **Responsive**: test at 1440px, 768px, and 375px widths — sidebar collapses, tables scroll, cards stack
8. **Role access**: login as viewer → action buttons hidden; login as admin → all actions visible
