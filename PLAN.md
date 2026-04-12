# SIGAH - Humanitarian Aid Management System

## Context

The 2026 flood in Monteria displaced ~10,000 people. A backend system is needed to register affected families, manage aid inventory (20,000 kg warehouse capacity), track donations by source (city hall, state government, private companies, citizens), distribute aid prioritizing vulnerable families, and prevent duplicate deliveries. The system must guarantee a minimum of 3 days of coverage per delivery and maintain full transparency. All entities with a physical location (shelters, warehouses, families) include geographic coordinates for map visualization.

**Stack**: Node.js + Express | PostgreSQL | Prisma (ORM) | JWT auth | React + TypeScript + Vite (frontend) | Monolith (single service)

**Architecture**: Monolithic — the Express server serves both the REST API (`/api/v1`) and the compiled React frontend (static files from `client/dist/`). In development, Vite's dev server proxies API requests to Express.

---

## Database Schema (16 tables)

### Geography and shelters
- **zones** - Affected geographic zones (name, risk_level: low/medium/high/critical, latitude, longitude, estimated_population)
- **shelters** - Temporary shelters (name, address, zone_id FK, max_capacity, current_occupancy, type, latitude, longitude)

### Population census
- **families** - Family units (family_code, head_document, zone_id FK, shelter_id FK, num_members, num_children_under_5, num_adults_over_65, num_pregnant, num_disabled, priority_score, status, latitude, longitude, reference_address)
- **persons** - Individual members (family_id FK, name, document, birth_date, gender, relationship, special_conditions[], requires_medication)

### Resources and inventory
- **warehouses** - Physical storage facilities (name, address, latitude, longitude, max_capacity_kg, current_weight_kg, status: active/inactive, zone_id FK)
- **resource_types** - Aid type catalog (name, category: food/shelter/hygiene/health, unit_of_measure, unit_weight_kg)
- **inventory** - Current stock per warehouse and resource_type (warehouse_id FK, resource_type_id FK, available_quantity, total_weight_kg, batch, expiration_date)

### Donations
- **donors** - Donor registry (name, type: city_hall/state_government/private_company/citizen/ngo, tax_id)
- **donations** - Donation events (donor_id FK, destination_warehouse_id FK, donation_type: in_kind/monetary/mixed, monetary_amount, date)
- **donation_details** - In-kind donated items (donation_id FK, resource_type_id FK, quantity, weight_kg)

### Distribution
- **deliveries** - Aid deliveries to families (family_id FK, source_warehouse_id FK, delivery_date, delivered_by FK, received_by_document, coverage_days CHECK >= 3, status, delivery_latitude, delivery_longitude)
- **delivery_details** - Delivered items (delivery_id FK, resource_type_id FK, quantity, weight_kg)

### Operations
- **users** - System users (email, password_hash, role: admin/coordinator/operator/viewer)
- **health_vectors** - Sanitary vectors per zone/shelter (vector_type, risk_level, actions_taken, latitude, longitude)
- **relocations** - Family relocation records (family_id FK, origin_shelter_id, destination_shelter_id, type: temporary/permanent)

---

## API Modules (prefix `/api/v1`)

### 1. Auth (`/auth`)
- POST `/login` (public), POST `/register` (admin), GET `/me`, PUT `/change-password`
- JWT with 8h expiration, payload: { id, email, role }

### 2. Families (`/families`)
- Full CRUD + GET `/:id/persons` + GET `/:id/deliveries` + GET `/:id/eligibility`

### 3. Persons (`/persons`)
- CRUD + GET `/search?document=X`

### 4. Zones (`/zones`)
- CRUD + GET `/:id/families` + GET `/:id/shelters` + GET `/:id/warehouses`

### 5. Shelters (`/shelters`)
- CRUD + PUT `/:id/occupancy`

### 6. Warehouses (`/warehouses`)
- CRUD + GET `/:id/inventory` + GET `/nearest?lat=X&lng=Y` (nearest warehouse with stock)

### 7. Inventory (`/resource-types`, `/inventory`)
- CRUD resource_types + GET inventory by warehouse + GET `/summary` + GET `/alerts` + PUT `/:id/adjustment`

### 8. Donors and Donations (`/donors`, `/donations`)
- CRUD donors + POST/GET donations (creating an in-kind donation transactionally updates destination warehouse inventory)

### 9. Deliveries (`/deliveries`)
- POST create delivery (validates eligibility, warehouse stock, minimum 3 days, decrements inventory in transaction)
- POST `/batch` - batch delivery to the top N highest-priority families
- GET list + GET `/:id` + PUT `/:id/status`

### 10. Prioritization (`/prioritization`)
- GET `/ranking` + POST `/recalculate` + GET `/next-batch?count=N`

### 11. Reports (`/reports`)
- GET `/coverage`, `/inventory`, `/donations-by-type`, `/deliveries-by-zone`, `/unattended-families`, `/dashboard`

### 12. Health Vectors (`/health/vectors`)
- CRUD sanitary vectors

### 13. Relocations (`/relocations`)
- POST create + GET list

### 14. Map (`/map`)
- GET `/shelters` - all shelters with coordinates and occupancy
- GET `/warehouses` - all warehouses with coordinates and stock level
- GET `/families` - families with location (coordinates + status + priority only, no sensitive data)
- GET `/vectors` - geolocated sanitary vectors
- GET `/zone/:id` - all geolocated entities within a zone
- GET `/recent-deliveries` - recent delivery points with coordinates

---

## Prioritization Algorithm

```
score = (2 * num_members)
      + (5 * num_children_under_5)
      + (4 * num_adults_over_65)
      + (5 * num_pregnant)
      + (4 * num_disabled)
      + (3 * zone_risk_factor)           // low=1, medium=2, high=3, critical=4
      + (1.5 * days_without_aid)         // max 30
      - (2 * deliveries_received)
```

Recalculated: on delivery creation, on family composition change, and on demand.

---

## Key Business Rules

1. **Duplicate prevention**: Cannot deliver to a family whose previous coverage has not expired
2. **Minimum 3 days**: Each delivery must cover at least 3 days (0.6 kg/person/day of food)
3. **Warehouse capacity**: Each warehouse has its own max_capacity_kg; current_weight_kg cannot exceed it
4. **Atomic transactions**: Deliveries and donations use DB transactions to maintain inventory consistency
5. **Sequential codes**: FAM-2026-00001, DON-2026-00001, DEL-2026-00001
6. **Required coordinates**: Shelters and warehouses require latitude/longitude on creation; families register them optionally

---

## Project Structure (Monolith)

```
SIGAH/
├── package.json                          # Root: orchestration scripts (dev, build, start)
├── .gitignore
│
├── server/                               # Express backend
│   ├── package.json                      # Backend dependencies and scripts
│   ├── .env / .env.example
│   ├── prisma/
│   │   ├── schema.prisma                 # Full DB schema
│   │   ├── migrations/                   # Prisma-generated migrations
│   │   └── seed.js                       # Initial data
│   ├── src/
│   │   ├── index.js                      # Entry point (serves API + client/dist in production)
│   │   ├── app.js                        # Express config
│   │   ├── config/
│   │   │   ├── prisma.js                 # PrismaClient instance (singleton)
│   │   │   ├── env.js                    # Environment variables
│   │   │   └── constants.js              # Business constants
│   │   ├── routes/                       # 14 route files
│   │   ├── controllers/                  # 14 controllers
│   │   ├── services/                     # 14 services (business logic, use Prisma Client directly)
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js        # JWT verification
│   │   │   ├── role.middleware.js        # Role-based access control
│   │   │   ├── validate.middleware.js    # express-validator
│   │   │   └── errorHandler.middleware.js# Global error handler
│   │   ├── validators/                   # Per-module validations
│   │   └── utils/
│   │       ├── AppError.js
│   │       ├── asyncHandler.js
│   │       └── pagination.js
│   └── tests/
│       ├── unit/                         # Service tests
│       └── integration/                  # Tests with supertest
│
└── client/                               # React frontend (see FRONTEND-PLAN.md)
    ├── package.json                      # Frontend dependencies and scripts
    ├── vite.config.ts                    # Vite config with API proxy to server
    ├── index.html
    ├── public/
    └── src/                              # React application source
```

> **Note**: There is no repository layer. Prisma Client acts as both ORM and data access layer. Services interact with `prisma` directly, using `prisma.$transaction()` for atomic operations.

### Monolith Scripts (root package.json)

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `concurrently` server + client | Development: Express API (port 3000) + Vite HMR (port 5173) |
| `npm run build` | `npm --prefix client run build` | Build React app to `client/dist/` |
| `npm start` | `npm --prefix server run start` | Production: Express serves API + `client/dist/` |
| `npm test` | `npm --prefix server run test` | Run backend tests |
| `npm run install:all` | install server + client | Install all dependencies |

### Production Serving

In production, `server/src/index.js` serves the compiled frontend:
```js
// After API routes
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});
```

### Development Proxy

In development, `client/vite.config.ts` proxies API calls to Express:
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true }
  }
}
```

---

## Main Libraries

| Library | Purpose |
|---------|---------|
| express ^4.18 | HTTP framework |
| @prisma/client ^6 | ORM - data access |
| prisma ^6 (devDep) | Migration CLI and client generation |
| bcrypt ^5.1 | Password hashing |
| jsonwebtoken ^9.0 | JWT authentication |
| express-validator ^7.0 | Request validation |
| cors, helmet, morgan | Security and HTTP logging |
| dotenv ^16.3 | Environment variables |
| jest ^29 + supertest ^6.3 | Testing |

---

## Implementation Plan (12 steps)

### Step 1: Project initialization
- Create monolith structure: root `package.json`, `server/`, `client/`
- `npm init` in `server/`, install backend dependencies, create `server/src/` folder structure
- Scaffold `client/` with Vite + React + TypeScript, install frontend dependencies
- Configure `.env`, `.gitignore`, Vite proxy
- `npx prisma init` in `server/` - generates `server/prisma/schema.prisma` with PostgreSQL datasource
- Create `server/src/config/env.js`, `server/src/config/prisma.js` (PrismaClient singleton), `server/src/config/constants.js`

### Step 2: Base infrastructure
- `server/src/app.js` - Express config with global middlewares (cors, helmet, morgan, json parser) + static file serving for `client/dist/` in production
- `server/src/index.js` - server startup with `prisma.$connect()` beforehand
- `server/src/utils/AppError.js`, `asyncHandler.js`, `pagination.js`
- `server/src/middlewares/errorHandler.middleware.js`, `validate.middleware.js`

### Step 3: Authentication module
- Define `User` model in schema.prisma
- `npx prisma migrate dev --name add-users`
- `auth.service.js` (register, login with bcrypt + JWT, uses Prisma Client)
- `auth.middleware.js` (token verification)
- `role.middleware.js` (role hierarchy)
- Seed: initial admin user

### Step 4: Zones and shelters
- `Zone`, `Shelter` models in schema.prisma (with latitude/longitude Float fields)
- `npx prisma migrate dev --name add-zones-shelters`
- Full CRUD for both entities
- Seeds with sample zones and shelters (with real Monteria coordinates)

### Step 5: Families and persons (census)
- `Family`, `Person` models in schema.prisma (Family with optional latitude/longitude, reference_address)
- `npx prisma migrate dev --name add-families-persons`
- CRUD families with sequential code generation
- CRUD persons linked to family
- Search by document
- Validations (num_members > 0, etc.)

### Step 6: Warehouses, resource types, and inventory
- `Warehouse`, `ResourceType`, `Inventory` models in schema.prisma (Warehouse with latitude/longitude, max_capacity_kg)
- `npx prisma migrate dev --name add-warehouses-inventory`
- CRUD warehouses with coordinates
- CRUD resource_types
- Inventory endpoints per warehouse (current stock, summary, alerts, manual adjustment)
- Warehouse capacity validation
- Nearest warehouse endpoint
- Seeds with base resource types and sample warehouses

### Step 7: Donors and donations
- `Donor`, `Donation`, `DonationDetail` models in schema.prisma (Donation with destination_warehouse_id)
- `npx prisma migrate dev --name add-donors-donations`
- CRUD donors
- Create donation with details (transaction via `prisma.$transaction()` that updates destination warehouse inventory)
- Donation history by donor

### Step 8: Prioritization algorithm
- `prioritization.service.js` with scoring formula
- Ranking endpoint
- Bulk recalculation endpoint
- Next batch endpoint

### Step 9: Delivery distribution
- `Delivery`, `DeliveryDetail` models in schema.prisma (Delivery with source_warehouse_id, delivery_latitude, delivery_longitude)
- `npx prisma migrate dev --name add-deliveries`
- Eligibility verification (duplicate prevention)
- Minimum ration calculation (3 days)
- Transactional delivery creation (validate warehouse stock, decrement inventory, recalculate priority)
- Batch delivery

### Step 10: Health vectors and relocations
- `HealthVector`, `Relocation` models in schema.prisma (HealthVector with latitude/longitude)
- `npx prisma migrate dev --name add-health-relocations`
- CRUD for both modules

### Step 11: Map and reports
- Map module: endpoints aggregating geolocated data from shelters, warehouses, families, vectors, and deliveries
- Reports: coverage, inventory, donations by type, deliveries by zone
- Unattended families (no delivery or expired coverage)
- Dashboard with key metrics

### Step 12: Testing and documentation
- Unit tests: prioritization, deliveries, inventory
- Integration tests: auth flow, complete delivery flow
- Test data seeds for demo (with real Monteria coordinates)

---

## Verification

1. **Unit tests**: `npm test` (from root) - prioritization calculates correctly, deliveries validate eligibility and stock
2. **Integration tests**: Complete auth flow, donation -> warehouse -> inventory -> delivery -> priority recalculated
3. **Build**: `npm run build` (from root) - compiles React frontend to `client/dist/`
4. **Production mode**: `npm start` - Express serves API at `/api/v1` and frontend at `/`
5. **Development mode**: `npm run dev` - runs both Vite (port 5173) and Express (port 3000) concurrently
6. **Manual**: Create families, register donations, execute deliveries, verify reports, attempt duplicates (should fail), attempt exceeding warehouse capacity (should fail), verify coordinates in map endpoints
