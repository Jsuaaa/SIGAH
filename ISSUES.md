# SIGAH - Project Issues (30)

> Issues derived from PLAN.md. Each issue includes title, description, acceptance criteria, dependencies, and suggested labels.

---

## Step 1: Project Initialization

### Issue #1 — Project scaffolding and dependency installation
**Labels**: `setup`, `priority: critical`, `step-1`
**Description**: Initialize the Node.js project with `npm init`, install all production and dev dependencies, and create the full folder structure as defined in the plan.

**Dependencies**: (production) express, @prisma/client, bcrypt, jsonwebtoken, express-validator, cors, helmet, morgan, dotenv — (dev) prisma, jest, supertest

**Acceptance Criteria**:
- [ ] `package.json` exists with all dependencies and scripts (`start`, `dev`, `test`)
- [ ] `node_modules/` installed without errors
- [ ] Folder structure created: `src/{config,routes,controllers,services,middlewares,validators,utils}`, `prisma/`, `tests/{unit,integration}`

---

### Issue #2 — Environment and git configuration
**Labels**: `setup`, `priority: critical`, `step-1`
**Description**: Create `.env.example` with all required environment variables (DATABASE_URL, JWT_SECRET, PORT, NODE_ENV), `.env` for local development, and `.gitignore` to exclude `node_modules`, `.env`, and Prisma generated files.

**Acceptance Criteria**:
- [ ] `.env.example` documents all required variables
- [ ] `.gitignore` covers `node_modules/`, `.env`, `prisma/*.db`
- [ ] Git repository initialized with initial commit

---

### Issue #3 — Prisma initialization and config modules
**Labels**: `setup`, `database`, `priority: critical`, `step-1`
**Description**: Run `npx prisma init` to generate `prisma/schema.prisma` with PostgreSQL datasource. Create config modules: `src/config/env.js` (loads and validates env vars), `src/config/prisma.js` (PrismaClient singleton), `src/config/constants.js` (business constants like MIN_COVERAGE_DAYS=3, KG_PER_PERSON_PER_DAY=0.6, MAX_DAYS_WITHOUT_AID=30, risk factors).

**Acceptance Criteria**:
- [ ] `prisma/schema.prisma` exists with `postgresql` provider and `env("DATABASE_URL")`
- [ ] `src/config/prisma.js` exports a singleton PrismaClient instance
- [ ] `src/config/env.js` validates required env vars on startup
- [ ] `src/config/constants.js` exports all business constants from the plan

---

## Step 2: Base Infrastructure

### Issue #4 — Express application setup (app.js)
**Labels**: `infrastructure`, `priority: critical`, `step-2`
**Depends on**: #1, #2
**Description**: Create `src/app.js` with Express configuration including global middlewares: `cors()`, `helmet()`, `morgan('dev')`, `express.json()`. Mount a base health-check route at `GET /api/v1/health`. Export the app instance.

**Acceptance Criteria**:
- [ ] `src/app.js` exports configured Express app
- [ ] All global middlewares applied (cors, helmet, morgan, json parser)
- [ ] `GET /api/v1/health` returns `{ status: "ok" }`
- [ ] API prefix is `/api/v1`

---

### Issue #5 — Server entry point (index.js)
**Labels**: `infrastructure`, `priority: critical`, `step-2`
**Depends on**: #3, #4
**Description**: Create `src/index.js` that connects to the database via `prisma.$connect()` before starting the Express server. Handle connection errors gracefully. Log the port and environment on startup.

**Acceptance Criteria**:
- [ ] Server starts only after successful database connection
- [ ] Startup logs show port and NODE_ENV
- [ ] Connection errors are caught and logged before process exit
- [ ] `npm run dev` starts the server successfully

---

### Issue #6 — Utilities and global error handling
**Labels**: `infrastructure`, `priority: critical`, `step-2`
**Description**: Implement core utilities and middlewares:
- `src/utils/AppError.js` — Custom error class with statusCode and isOperational flag
- `src/utils/asyncHandler.js` — Wraps async route handlers to catch errors
- `src/utils/pagination.js` — Parses `page` and `limit` query params, returns `skip`/`take` for Prisma and pagination metadata
- `src/middlewares/errorHandler.middleware.js` — Global error handler that formats AppError and unexpected errors
- `src/middlewares/validate.middleware.js` — Runs express-validator checks and returns 400 with formatted errors

**Acceptance Criteria**:
- [ ] `AppError` supports custom status codes and error messages
- [ ] `asyncHandler` forwards rejected promises to Express error handler
- [ ] `pagination` defaults to page=1, limit=20 and returns `{ skip, take, page, limit }`
- [ ] Error handler returns JSON `{ success: false, message, errors? }` with proper status codes
- [ ] Validation middleware returns `{ success: false, errors: [...] }` on invalid input

---

## Step 3: Authentication Module

### Issue #7 — User model and migration
**Labels**: `database`, `auth`, `priority: critical`, `step-3`
**Depends on**: #3
**Description**: Define the `User` model in `schema.prisma` with fields: id, email (unique), password_hash, role (enum: ADMIN/COORDINATOR/OPERATOR/VIEWER), created_at, updated_at. Run `npx prisma migrate dev --name add-users`.

**Acceptance Criteria**:
- [ ] `User` model defined with all fields and enum role
- [ ] Migration generated and applied successfully
- [ ] PrismaClient regenerated with User type

---

### Issue #8 — Auth service, controller, and routes
**Labels**: `auth`, `priority: critical`, `step-3`
**Depends on**: #6, #7
**Description**: Implement the authentication module:
- `src/services/auth.service.js` — register (hash password with bcrypt, create user), login (verify credentials, generate JWT with 8h expiry, payload: { id, email, role }), getProfile, changePassword
- `src/controllers/auth.controller.js` — handle HTTP layer
- `src/routes/auth.routes.js` — POST `/login` (public), POST `/register` (admin only), GET `/me`, PUT `/change-password`
- `src/validators/auth.validator.js` — email format, password min length, role enum

**Acceptance Criteria**:
- [ ] Register creates user with hashed password (bcrypt)
- [ ] Login returns JWT token with 8h expiration
- [ ] JWT payload contains `{ id, email, role }`
- [ ] `/me` returns current user profile (no password_hash)
- [ ] Change password verifies old password before updating
- [ ] Validation rejects invalid email, weak password, invalid role

---

### Issue #9 — Auth and role middlewares + admin seed
**Labels**: `auth`, `middleware`, `priority: critical`, `step-3`
**Depends on**: #8
**Description**: Implement:
- `src/middlewares/auth.middleware.js` — Extracts and verifies JWT from `Authorization: Bearer <token>`, attaches user to `req.user`
- `src/middlewares/role.middleware.js` — Factory function `authorize(...roles)` that checks `req.user.role` against allowed roles
- `prisma/seed.js` — Seeds initial admin user (email from env or default)
- Add `"prisma": { "seed": "node prisma/seed.js" }` to package.json

**Acceptance Criteria**:
- [ ] Unauthenticated requests get 401 with message
- [ ] Invalid/expired tokens get 401
- [ ] Unauthorized roles get 403 with message
- [ ] `npx prisma db seed` creates admin user
- [ ] Admin user can register new users; non-admins cannot

---

## Step 4: Zones and Shelters

### Issue #10 — Zone model and full CRUD
**Labels**: `feature`, `geo`, `step-4`
**Depends on**: #9
**Description**: Define the `Zone` model in schema.prisma (name, risk_level enum: LOW/MEDIUM/HIGH/CRITICAL, latitude Float, longitude Float, estimated_population Int). Migrate. Implement full CRUD with routes, controller, service, and validators. Include nested endpoints: `GET /:id/families`, `GET /:id/shelters`, `GET /:id/warehouses`. Seed with sample Monteria zones.

**Acceptance Criteria**:
- [ ] Zone model with all fields including coordinates
- [ ] CRUD endpoints: POST, GET (list with pagination), GET /:id, PUT /:id, DELETE /:id
- [ ] Nested endpoints return related entities
- [ ] Validators check required fields, risk_level enum, coordinate ranges
- [ ] Role protection: create/update/delete require ADMIN or COORDINATOR
- [ ] Seed data with real Monteria coordinates

---

### Issue #11 — Shelter model and full CRUD
**Labels**: `feature`, `geo`, `step-4`
**Depends on**: #10
**Description**: Define the `Shelter` model (name, address, zone_id FK, max_capacity Int, current_occupancy Int default 0, type String, latitude Float required, longitude Float required). Migrate. Implement full CRUD plus `PUT /:id/occupancy` to update current_occupancy. Seed with sample shelters.

**Acceptance Criteria**:
- [ ] Shelter model with zone relation and required coordinates
- [ ] CRUD endpoints with zone_id validation (zone must exist)
- [ ] `PUT /:id/occupancy` validates occupancy <= max_capacity
- [ ] List endpoint supports filtering by zone_id
- [ ] Seed data linked to existing zones

---

## Step 5: Families and Persons

### Issue #12 — Family model and CRUD with sequential codes
**Labels**: `feature`, `census`, `priority: high`, `step-5`
**Depends on**: #10
**Description**: Define the `Family` model (family_code unique, head_document, zone_id FK, shelter_id FK optional, num_members, num_children_under_5, num_adults_over_65, num_pregnant, num_disabled, priority_score Float default 0, status enum: REGISTERED/ACTIVE/RELOCATED/INACTIVE, latitude Float optional, longitude Float optional, reference_address optional). Migrate. Implement CRUD with automatic sequential code generation (FAM-2026-00001). Include `GET /:id/deliveries` and `GET /:id/eligibility`.

**Acceptance Criteria**:
- [ ] Family model with all fields and zone/shelter relations
- [ ] Sequential code auto-generated on creation (FAM-YYYY-NNNNN)
- [ ] `num_members` validated > 0
- [ ] `GET /:id/eligibility` returns whether family can receive aid
- [ ] `GET /:id/deliveries` returns delivery history
- [ ] List supports filtering by zone_id, status, and sorting by priority_score

---

### Issue #13 — Person model and CRUD
**Labels**: `feature`, `census`, `step-5`
**Depends on**: #12
**Description**: Define the `Person` model (family_id FK, name, document unique, birth_date DateTime, gender enum, relationship String, special_conditions String[], requires_medication Boolean). Migrate. Implement CRUD linked to family. Include `GET /search?document=X` for person lookup.

**Acceptance Criteria**:
- [ ] Person model with family relation
- [ ] CRUD validates family_id exists
- [ ] Document search returns person with family info
- [ ] Creating/deleting persons updates family member counts (num_members, etc.)
- [ ] special_conditions stored as array

---

### Issue #14 — Family-Person composition sync and validations
**Labels**: `feature`, `census`, `step-5`
**Depends on**: #12, #13
**Description**: Ensure consistency between Person records and Family aggregate fields. When persons are added/removed from a family, automatically recalculate: num_members, num_children_under_5 (age < 5 from birth_date), num_adults_over_65 (age > 65), num_pregnant (from special_conditions), num_disabled (from special_conditions). Trigger priority score recalculation on composition change.

**Acceptance Criteria**:
- [ ] Adding a person updates family aggregate counts
- [ ] Removing a person updates family aggregate counts
- [ ] Age-based counts (children under 5, adults over 65) calculated from birth_date
- [ ] Priority score recalculated after composition change
- [ ] Cannot delete last person from a family (num_members >= 1)

---

## Step 6: Warehouses, Resource Types, and Inventory

### Issue #15 — Warehouse model and CRUD with coordinates
**Labels**: `feature`, `inventory`, `geo`, `step-6`
**Depends on**: #10
**Description**: Define the `Warehouse` model (name, address, latitude Float required, longitude Float required, max_capacity_kg Float, current_weight_kg Float default 0, status enum: ACTIVE/INACTIVE, zone_id FK). Migrate. Implement full CRUD with capacity validation.

**Acceptance Criteria**:
- [ ] Warehouse model with required coordinates and zone relation
- [ ] CRUD with zone_id validation
- [ ] Cannot set current_weight_kg > max_capacity_kg
- [ ] List supports filtering by zone_id and status
- [ ] Seed with sample warehouses (20,000 kg total capacity)

---

### Issue #16 — Resource types CRUD and inventory endpoints
**Labels**: `feature`, `inventory`, `step-6`
**Depends on**: #15
**Description**: Define `ResourceType` model (name, category enum: FOOD/SHELTER/HYGIENE/HEALTH, unit_of_measure, unit_weight_kg Float) and `Inventory` model (warehouse_id FK, resource_type_id FK, available_quantity Int, total_weight_kg Float, batch String, expiration_date DateTime). Migrate. Implement CRUD for resource_types. Implement inventory endpoints: `GET /inventory?warehouse_id=X`, `GET /inventory/summary`, `PUT /inventory/:id/adjustment`.

**Acceptance Criteria**:
- [ ] ResourceType and Inventory models with proper relations
- [ ] Unique constraint on Inventory (warehouse_id, resource_type_id, batch)
- [ ] Resource types seeded with base catalog (rice, beans, water, blankets, soap, first-aid kits, etc.)
- [ ] Inventory summary aggregates across warehouses
- [ ] Manual adjustment validates warehouse capacity

---

### Issue #17 — Inventory alerts and nearest warehouse endpoint
**Labels**: `feature`, `inventory`, `geo`, `step-6`
**Depends on**: #16
**Description**: Implement:
- `GET /inventory/alerts` — Returns items below a configurable threshold, items expiring within 7 days, and warehouses above 90% capacity
- `GET /warehouses/nearest?lat=X&lng=Y` — Finds the nearest warehouse with available stock using Haversine distance calculation

**Acceptance Criteria**:
- [ ] Low stock alerts with configurable threshold
- [ ] Expiration alerts for items expiring within 7 days
- [ ] Capacity alerts for warehouses above 90%
- [ ] Nearest warehouse calculated using Haversine formula
- [ ] Nearest endpoint only returns ACTIVE warehouses with stock > 0

---

## Step 7: Donors and Donations

### Issue #18 — Donor model and CRUD
**Labels**: `feature`, `donations`, `step-7`
**Depends on**: #9
**Description**: Define the `Donor` model (name, type enum: CITY_HALL/STATE_GOVERNMENT/PRIVATE_COMPANY/CITIZEN/NGO, tax_id String optional unique). Migrate. Implement full CRUD with validators.

**Acceptance Criteria**:
- [ ] Donor model with type enum
- [ ] CRUD with validations
- [ ] List supports filtering by donor type
- [ ] tax_id unique when provided

---

### Issue #19 — Donation creation with transactional inventory update
**Labels**: `feature`, `donations`, `inventory`, `priority: high`, `step-7`
**Depends on**: #16, #18
**Description**: Define `Donation` model (donor_id FK, destination_warehouse_id FK, donation_type enum: IN_KIND/MONETARY/MIXED, monetary_amount Float optional, date DateTime, donation_code unique) and `DonationDetail` model (donation_id FK, resource_type_id FK, quantity Int, weight_kg Float). Migrate. Implement donation creation endpoint that uses `prisma.$transaction()` to atomically: create donation + details, update inventory quantities and weights in destination warehouse, update warehouse current_weight_kg. Validate warehouse capacity is not exceeded. Sequential code: DON-YYYY-NNNNN.

**Acceptance Criteria**:
- [ ] Donation and DonationDetail models
- [ ] Sequential donation code generation
- [ ] In-kind donation atomically updates inventory and warehouse weight
- [ ] Transaction rolls back if warehouse capacity would be exceeded
- [ ] Monetary donations stored without inventory impact
- [ ] `GET /donations` with filters by donor, type, date range
- [ ] `GET /donors/:id/donations` returns donor's donation history

---

## Step 8: Prioritization Algorithm

### Issue #20 — Prioritization scoring service
**Labels**: `feature`, `algorithm`, `priority: high`, `step-8`
**Depends on**: #12
**Description**: Implement `src/services/prioritization.service.js` with the scoring formula:
```
score = (2 * num_members) + (5 * children_under_5) + (4 * adults_over_65) + (5 * pregnant) + (4 * disabled) + (3 * zone_risk_factor) + (1.5 * days_without_aid) - (2 * deliveries_received)
```
Zone risk factors: LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4. Days without aid capped at 30.

**Acceptance Criteria**:
- [ ] Scoring formula implemented exactly as specified
- [ ] `calculateScore(family)` returns correct score given family data
- [ ] Days without aid calculated from last delivery date (or registration date if no deliveries)
- [ ] Zone risk factor resolved from family's zone
- [ ] Unit tests cover edge cases: new family (no deliveries), max days cap, all vulnerability factors

---

### Issue #21 — Prioritization API endpoints
**Labels**: `feature`, `algorithm`, `step-8`
**Depends on**: #20
**Description**: Implement prioritization endpoints:
- `GET /prioritization/ranking` — Returns families ordered by priority_score descending, with pagination
- `POST /prioritization/recalculate` — Bulk recalculates scores for all active families and updates their priority_score field
- `GET /prioritization/next-batch?count=N` — Returns the top N highest-priority eligible families (not currently covered)

**Acceptance Criteria**:
- [ ] Ranking returns paginated list sorted by score DESC
- [ ] Recalculate updates all active families' scores
- [ ] Next-batch filters out families with active coverage
- [ ] Recalculate endpoint restricted to ADMIN and COORDINATOR roles
- [ ] Response includes family_code, priority_score, zone, last_delivery_date

---

## Step 9: Delivery Distribution

### Issue #22 — Delivery and DeliveryDetail models
**Labels**: `database`, `deliveries`, `step-9`
**Depends on**: #12, #15
**Description**: Define `Delivery` model (family_id FK, source_warehouse_id FK, delivery_date DateTime, delivered_by FK to User, received_by_document String, coverage_days Int CHECK >= 3, status enum: SCHEDULED/IN_TRANSIT/DELIVERED/CANCELLED, delivery_latitude Float optional, delivery_longitude Float optional, delivery_code unique) and `DeliveryDetail` model (delivery_id FK, resource_type_id FK, quantity Int, weight_kg Float). Migrate.

**Acceptance Criteria**:
- [ ] Delivery model with all relations and constraints
- [ ] coverage_days has database-level CHECK >= 3
- [ ] Sequential delivery code: DEL-YYYY-NNNNN
- [ ] DeliveryDetail linked to Delivery and ResourceType
- [ ] Migration applied successfully

---

### Issue #23 — Eligibility verification and ration calculation
**Labels**: `feature`, `deliveries`, `priority: high`, `step-9`
**Depends on**: #20, #22
**Description**: Implement in delivery service:
- **Eligibility check**: A family is eligible if they have no active delivery whose coverage period has not expired (delivery_date + coverage_days > today = not eligible)
- **Minimum ration calculation**: For a given family and coverage_days, calculate minimum food quantity: `num_members * 0.6 kg/person/day * coverage_days`. Ensure coverage_days >= 3.

**Acceptance Criteria**:
- [ ] `checkEligibility(familyId)` returns { eligible: boolean, reason?, last_delivery?, coverage_expires? }
- [ ] Duplicate delivery to covered family returns 409 Conflict
- [ ] Minimum ration calculated correctly
- [ ] coverage_days < 3 rejected with 400

---

### Issue #24 — Transactional delivery creation and batch delivery
**Labels**: `feature`, `deliveries`, `priority: high`, `step-9`
**Depends on**: #23
**Description**: Implement delivery creation using `prisma.$transaction()`:
1. Verify family eligibility
2. Verify source warehouse has sufficient stock for all items
3. Create Delivery + DeliveryDetails
4. Decrement inventory quantities and weights
5. Update warehouse current_weight_kg
6. Recalculate family priority score

Also implement `POST /deliveries/batch` — accepts count N, fetches top N priority families from next-batch, creates deliveries for each with a standard aid package from the nearest warehouse with stock.

**Acceptance Criteria**:
- [ ] Single delivery creation is fully atomic (all or nothing)
- [ ] Insufficient stock returns 400 with details of missing items
- [ ] Inventory and warehouse weight decremented correctly
- [ ] Family priority score recalculated after delivery
- [ ] Batch delivery processes top N families
- [ ] Batch skips families that become ineligible during processing
- [ ] `GET /deliveries` with filters (family, warehouse, status, date range)
- [ ] `PUT /deliveries/:id/status` to update delivery status

---

## Step 10: Health Vectors and Relocations

### Issue #25 — Health vectors model and CRUD
**Labels**: `feature`, `health`, `geo`, `step-10`
**Depends on**: #10
**Description**: Define `HealthVector` model (vector_type String, risk_level enum: LOW/MEDIUM/HIGH/CRITICAL, zone_id FK optional, shelter_id FK optional, actions_taken String, latitude Float, longitude Float, reported_date DateTime, reported_by FK to User). Migrate. Implement full CRUD.

**Acceptance Criteria**:
- [ ] HealthVector model with coordinates and zone/shelter relations
- [ ] CRUD with role protection (ADMIN, COORDINATOR, OPERATOR)
- [ ] List supports filtering by zone, shelter, risk_level, vector_type
- [ ] Validators check coordinate ranges and required fields

---

### Issue #26 — Relocation model and CRUD
**Labels**: `feature`, `relocations`, `step-10`
**Depends on**: #11, #12
**Description**: Define `Relocation` model (family_id FK, origin_shelter_id FK, destination_shelter_id FK, type enum: TEMPORARY/PERMANENT, relocation_date DateTime, reason String, authorized_by FK to User). Migrate. Implement `POST /relocations` (creates relocation, updates family shelter_id, adjusts occupancy on both shelters) and `GET /relocations` (list with filters).

**Acceptance Criteria**:
- [ ] Relocation model with family and shelter relations
- [ ] Creating a relocation updates family.shelter_id to destination
- [ ] Origin shelter occupancy decremented, destination incremented
- [ ] Destination shelter occupancy cannot exceed max_capacity
- [ ] List supports filtering by family, shelter, type, date range

---

## Step 11: Map and Reports

### Issue #27 — Map module: geolocation endpoints
**Labels**: `feature`, `geo`, `map`, `step-11`
**Depends on**: #11, #15, #12, #25
**Description**: Implement map endpoints that aggregate geolocated data:
- `GET /map/shelters` — All shelters with coordinates, occupancy, and capacity
- `GET /map/warehouses` — All warehouses with coordinates and stock level percentage
- `GET /map/families` — Families with coordinates, status, and priority_score only (no personal data)
- `GET /map/vectors` — Geolocated health vectors with risk level
- `GET /map/zone/:id` — All geolocated entities within a specific zone
- `GET /map/recent-deliveries` — Delivery points from last 7 days with coordinates

**Acceptance Criteria**:
- [ ] All map endpoints return GeoJSON-compatible coordinate data
- [ ] Family endpoint excludes sensitive data (names, documents)
- [ ] Zone endpoint aggregates all entity types within the zone
- [ ] Recent deliveries filtered to last 7 days
- [ ] Endpoints are read-only, accessible to all authenticated roles

---

### Issue #28 — Reports module: coverage and inventory reports
**Labels**: `feature`, `reports`, `step-11`
**Depends on**: #16, #24
**Description**: Implement:
- `GET /reports/coverage` — Percentage of families with active coverage vs total, broken down by zone
- `GET /reports/inventory` — Current stock levels across all warehouses, categorized by resource type
- `GET /reports/unattended-families` — Families with no delivery or expired coverage, sorted by priority_score

**Acceptance Criteria**:
- [ ] Coverage report shows covered/uncovered counts and percentages per zone
- [ ] Inventory report aggregates quantities and weights by category
- [ ] Unattended families sorted by priority descending
- [ ] Reports support date range filters where applicable
- [ ] Response format consistent across all report endpoints

---

### Issue #29 — Reports module: donations, deliveries by zone, and dashboard
**Labels**: `feature`, `reports`, `step-11`
**Depends on**: #19, #24, #28
**Description**: Implement:
- `GET /reports/donations-by-type` — Total donations grouped by donor type, with monetary and in-kind totals
- `GET /reports/deliveries-by-zone` — Delivery counts and total weight distributed per zone
- `GET /reports/dashboard` — Aggregated key metrics: total families registered, total aided, total pending, warehouse utilization %, total donations received, total kg distributed, active health vectors count

**Acceptance Criteria**:
- [ ] Donations grouped by donor type with subtotals
- [ ] Deliveries aggregated by zone with counts and weights
- [ ] Dashboard returns all key metrics in a single response
- [ ] Dashboard queries are optimized (avoid N+1 queries)
- [ ] All reports accessible to ADMIN, COORDINATOR, and VIEWER roles

---

## Step 12: Testing and Documentation

### Issue #30 — Unit and integration tests + test seeds
**Labels**: `testing`, `step-12`
**Depends on**: #20, #23, #24
**Description**: Write tests:
- **Unit tests** (`tests/unit/`):
  - `prioritization.test.js` — Score calculation with various family compositions
  - `delivery.test.js` — Eligibility checks, ration calculations
  - `inventory.test.js` — Capacity validation, weight calculations
- **Integration tests** (`tests/integration/`):
  - `auth.test.js` — Register, login, token validation, role protection
  - `delivery-flow.test.js` — End-to-end: create donation -> verify inventory -> create delivery -> verify stock decremented -> verify priority recalculated -> attempt duplicate (should fail)
- `prisma/seed.js` — Enhance seed with comprehensive test/demo data including families, donors, resource types, and sample deliveries (using real Monteria coordinates)

**Acceptance Criteria**:
- [ ] `npm test` runs all tests successfully
- [ ] Prioritization tests cover: new family, max days cap, all vulnerability factors, zero score edge case
- [ ] Delivery tests cover: eligible family, duplicate prevention, insufficient stock, coverage_days < 3
- [ ] Integration auth test covers full login/register/protected-route flow
- [ ] Integration delivery flow covers donation-to-delivery pipeline
- [ ] Seed creates realistic demo data for presentations
- [ ] Test coverage reported via Jest

---

## Issue Dependency Graph

```
#1 ─┬─ #2 ─── #3 ─┬─ #7 ─── #8 ─── #9 ──┬── #10 ─── #11
    │              │                       │     │       │
    └──── #4 ──────┴─ #5                   │     │       │
          │                                │     │       │
          └─── #6 ─────────────────────────┘     │       │
                                                 │       │
    #10 ────┬── #12 ─── #13 ─── #14             │       │
            │    │                               │       │
            │    └──── #20 ─── #21              │       │
            │    │                               │       │
            ├── #15 ─── #16 ─── #17             │       │
            │    │                               │       │
            │    └──────┬── #19                  │       │
            │           │                        │       │
            ├── #18 ────┘                        │       │
            │                                    │       │
            ├── #25 ────────────────────────────┘       │
            │                                            │
            └── #26 ────────────────────────────────────┘
                 │
    #22 ─── #23 ─── #24
                      │
    #27 ──────────────┤
    #28 ──────────────┤
    #29 ──────────────┤
    #30 ──────────────┘
```

## Summary by Step

| Step | Issues | Description |
|------|--------|-------------|
| 1 | #1, #2, #3 | Project initialization |
| 2 | #4, #5, #6 | Base infrastructure |
| 3 | #7, #8, #9 | Authentication |
| 4 | #10, #11 | Zones and shelters |
| 5 | #12, #13, #14 | Families and persons |
| 6 | #15, #16, #17 | Warehouses and inventory |
| 7 | #18, #19 | Donors and donations |
| 8 | #20, #21 | Prioritization algorithm |
| 9 | #22, #23, #24 | Delivery distribution |
| 10 | #25, #26 | Health vectors and relocations |
| 11 | #27, #28, #29 | Map and reports |
| 12 | #30 | Testing and documentation |

## Labels Reference

| Label | Meaning |
|-------|---------|
| `priority: critical` | Blocks multiple other issues |
| `priority: high` | Core business logic |
| `setup` | Project setup and configuration |
| `infrastructure` | Base architecture |
| `database` | Schema and migrations |
| `auth` | Authentication and authorization |
| `middleware` | Express middlewares |
| `feature` | New functionality |
| `census` | Population registration |
| `inventory` | Warehouse and stock management |
| `donations` | Donor and donation management |
| `deliveries` | Aid distribution |
| `algorithm` | Scoring and calculations |
| `health` | Sanitary vectors |
| `relocations` | Family relocations |
| `geo` | Geolocation features |
| `map` | Map visualization endpoints |
| `reports` | Reporting and analytics |
| `testing` | Tests and test data |
| `step-N` | Corresponds to plan step N |
