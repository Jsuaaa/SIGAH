-- =============================================================================
-- SIGAH — Sistema de Gestión y Distribución de Ayudas Humanitarias
-- Script único de creación de base de datos (PostgreSQL 15+)
-- =============================================================================
-- Fuente de verdad: docs/RELATIONAL-MODEL.md, docs/ERD.md, PLAN.md, ISSUES.md,
-- MIGRATION-PRISMA-TO-SP.md y los artefactos en server/db/{migrations,procedures,seeds}.
--
-- Genera el esquema "final" alineado al PDF (Iteración 3): 22 tablas, 6 roles,
-- enums completos, índices, triggers de reglas de negocio, stored procedures
-- por módulo y semillas mínimas (scoring_config + zonas de Montería).
--
-- IDEMPOTENTE: usa DROP SCHEMA public CASCADE al inicio para garantizar un
-- estado limpio. Si se quiere preservar datos existentes, comentar la sección
-- "## 0. RESET DE ESQUEMA" y aplicar manualmente.
--
-- Convenciones (server/db/README.md):
--   - fn_<entidad>_<acción>  : retorna fila/conjunto (LANGUAGE sql STABLE o plpgsql).
--   - sp_<entidad>_<acción>  : orquesta transacciones complejas (multi-tabla, audit).
--   - Parámetros: prefijo p_ (p_email, p_family_id…).
--   - Errores tipados con SQLSTATEs SH4xx (mapeados a HTTP por src/types/pg-errors.ts):
--        SH401 → 401  · SH403 → 403  · SH404 → 404
--        SH409 → 409  · SH422 → 422  · SH423 → 423 (locked).
--
-- Uso:
--   psql "$DATABASE_URL" -f server/db/build-database.sql
--   (o desde el runner: pnpm --filter server db:reset)
-- =============================================================================


-- =============================================================================
-- ## 0. RESET DE ESQUEMA (solo dev / staging)
-- =============================================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
COMMENT ON SCHEMA public IS 'SIGAH — esquema único, generado por build-database.sql';


-- =============================================================================
-- ## 1. EXTENSIONES
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest helpers
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- búsquedas trigram <2s (RNF-04, HU-06)


-- =============================================================================
-- ## 2. TIPOS ENUM (RELATIONAL-MODEL §2)
-- =============================================================================
CREATE TYPE role AS ENUM (
    'ADMIN',
    'CENSADOR',
    'OPERADOR_ENTREGAS',
    'COORDINADOR_LOGISTICA',
    'FUNCIONARIO_CONTROL',
    'REGISTRADOR_DONACIONES'
);

CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE family_status AS ENUM ('ACTIVO', 'EN_REFUGIO', 'EVACUADO');

CREATE TYPE relationship AS ENUM (
    'ESPOSO_A', 'HIJO_A', 'PADRE_MADRE', 'HERMANO_A', 'OTRO'
);

CREATE TYPE special_condition AS ENUM (
    'CHILD_UNDER_5', 'ELDERLY_OVER_65', 'PREGNANT', 'DISABLED', 'REQUIRES_MEDICATION'
);

CREATE TYPE shelter_type AS ENUM (
    'SCHOOL', 'SPORTS_CENTER', 'CHURCH', 'COMMUNITY_CENTER', 'OTHER'
);

CREATE TYPE warehouse_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE resource_category AS ENUM (
    'FOOD', 'BLANKET', 'MATTRESS', 'HYGIENE', 'MEDICATION'
);

CREATE TYPE donor_type AS ENUM (
    'PERSONA_NATURAL', 'EMPRESA', 'ALCALDIA', 'GOBERNACION', 'ORGANIZACION'
);

CREATE TYPE donation_type AS ENUM ('IN_KIND', 'MONETARY', 'MIXED');

CREATE TYPE plan_status AS ENUM (
    'PROGRAMADA', 'EN_EJECUCION', 'COMPLETADA', 'CANCELADA'
);

CREATE TYPE plan_scope AS ENUM ('GLOBAL', 'ZONA', 'REFUGIO', 'LOTE');

CREATE TYPE plan_item_status AS ENUM ('PENDIENTE', 'ENTREGADO', 'SIN_ATENDER');

CREATE TYPE delivery_status AS ENUM ('PROGRAMADA', 'EN_CURSO', 'ENTREGADA');

CREATE TYPE vector_type AS ENUM (
    'AGUA_CONTAMINADA', 'INSECTOS', 'ROEDORES', 'OTRO'
);

CREATE TYPE vector_status AS ENUM ('ACTIVO', 'EN_ATENCION', 'RESUELTO');

CREATE TYPE relocation_type AS ENUM ('TEMPORARY', 'PERMANENT');

CREATE TYPE adjustment_reason AS ENUM ('MERMA', 'DANO', 'DEVOLUCION', 'CORRECCION');


-- =============================================================================
-- ## 3. HELPERS GLOBALES
-- =============================================================================

-- 3.1 Trigger genérico para mantener updated_at en sync.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;


-- 3.2 Generador de códigos secuenciales anuales (RN-07).
--     Formato: <PREFIX>-<YYYY>-<NNNNN>. Usa SELECT … FOR UPDATE sobre la tabla
--     contador para garantizar atomicidad bajo concurrencia.
CREATE TABLE code_counters (
    prefix      VARCHAR(10) NOT NULL,
    year        INTEGER     NOT NULL,
    last_number INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (prefix, year)
);

CREATE OR REPLACE FUNCTION fn_next_code(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
    v_year   INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
    v_number INTEGER;
BEGIN
    INSERT INTO code_counters (prefix, year, last_number)
    VALUES (p_prefix, v_year, 0)
    ON CONFLICT (prefix, year) DO NOTHING;

    UPDATE code_counters
       SET last_number = last_number + 1
     WHERE prefix = p_prefix AND year = v_year
    RETURNING last_number INTO v_number;

    RETURN p_prefix || '-' || v_year || '-' || lpad(v_number::TEXT, 5, '0');
END $$;


-- =============================================================================
-- ## 4. TABLAS (orden topológico de dependencias)
-- =============================================================================

-- ── T1. USERS ────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                     BIGSERIAL PRIMARY KEY,
    email                  VARCHAR(120) NOT NULL UNIQUE,
    name                   VARCHAR(120) NOT NULL,
    password_hash          VARCHAR(80)  NOT NULL,
    role                   role         NOT NULL DEFAULT 'FUNCIONARIO_CONTROL',
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    failed_login_attempts  SMALLINT     NOT NULL DEFAULT 0,
    locked_until           TIMESTAMP(3),
    last_login_at          TIMESTAMP(3),
    password_must_change   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at             TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX users_email_idx ON users (email);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T2. AUDIT_LOGS ───────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    action      VARCHAR(50)  NOT NULL,
    module      VARCHAR(50)  NOT NULL,
    entity      VARCHAR(80)  NOT NULL,
    entity_id   BIGINT,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    before      JSONB,
    after       JSONB,
    ip_address  INET,
    user_agent  VARCHAR(255),
    created_at  TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_created_idx ON audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx       ON audit_logs (module, entity, entity_id);


-- ── T3. SCORING_CONFIG ───────────────────────────────────────────────────────
CREATE TABLE scoring_config (
    key         VARCHAR(40)    PRIMARY KEY,
    value       NUMERIC(10,3)  NOT NULL,
    updated_by  BIGINT         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at  TIMESTAMP(3)   NOT NULL DEFAULT now()
);


-- ── T5. ZONES ────────────────────────────────────────────────────────────────
CREATE TABLE zones (
    id                   BIGSERIAL PRIMARY KEY,
    name                 VARCHAR(120) NOT NULL UNIQUE,
    risk_level           risk_level   NOT NULL,
    latitude             NUMERIC(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude            NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    estimated_population INTEGER      NOT NULL CHECK (estimated_population >= 0),
    created_at           TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX zones_name_trgm_idx ON zones USING gin (name gin_trgm_ops);
CREATE TRIGGER zones_set_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T6. SHELTERS ─────────────────────────────────────────────────────────────
CREATE TABLE shelters (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(150) NOT NULL,
    address           VARCHAR(255) NOT NULL,
    zone_id           BIGINT       NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    type              shelter_type NOT NULL,
    max_capacity      INTEGER      NOT NULL CHECK (max_capacity > 0),
    current_occupancy INTEGER      NOT NULL DEFAULT 0
                                   CHECK (current_occupancy >= 0
                                          AND current_occupancy <= max_capacity),
    latitude          NUMERIC(9,6) NOT NULL,
    longitude         NUMERIC(9,6) NOT NULL,
    created_at        TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP(3) NOT NULL DEFAULT now(),
    UNIQUE (name, zone_id)
);
CREATE INDEX shelters_zone_idx ON shelters (zone_id);
CREATE TRIGGER shelters_set_updated_at BEFORE UPDATE ON shelters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T10. WAREHOUSES ──────────────────────────────────────────────────────────
CREATE TABLE warehouses (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(150)  NOT NULL UNIQUE,
    address           VARCHAR(255)  NOT NULL,
    zone_id           BIGINT        NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    max_capacity_kg   NUMERIC(10,2) NOT NULL CHECK (max_capacity_kg > 0),
    current_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0
                                   CHECK (current_weight_kg >= 0
                                          AND current_weight_kg <= max_capacity_kg),
    status            warehouse_status NOT NULL DEFAULT 'ACTIVE',
    latitude          NUMERIC(9,6)  NOT NULL,
    longitude         NUMERIC(9,6)  NOT NULL,
    created_at        TIMESTAMP(3)  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP(3)  NOT NULL DEFAULT now()
);
CREATE INDEX warehouses_zone_idx ON warehouses (zone_id);
CREATE TRIGGER warehouses_set_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T11. RESOURCE_TYPES ──────────────────────────────────────────────────────
CREATE TABLE resource_types (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(120)      NOT NULL,
    category        resource_category NOT NULL,
    unit_of_measure VARCHAR(20)       NOT NULL,
    unit_weight_kg  NUMERIC(10,3)     NOT NULL CHECK (unit_weight_kg > 0),
    is_active       BOOLEAN           NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP(3)      NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP(3)      NOT NULL DEFAULT now(),
    UNIQUE (name, category)
);
CREATE TRIGGER resource_types_set_updated_at BEFORE UPDATE ON resource_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T4. ALERT_THRESHOLDS ─────────────────────────────────────────────────────
CREATE TABLE alert_thresholds (
    id               BIGSERIAL PRIMARY KEY,
    resource_type_id BIGINT       NOT NULL UNIQUE
                                  REFERENCES resource_types(id) ON DELETE CASCADE,
    min_quantity     INTEGER      NOT NULL CHECK (min_quantity >= 0),
    updated_by       BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at       TIMESTAMP(3) NOT NULL DEFAULT now()
);


-- ── T7. FAMILIES ─────────────────────────────────────────────────────────────
CREATE TABLE families (
    id                       BIGSERIAL PRIMARY KEY,
    family_code              VARCHAR(20)   NOT NULL UNIQUE
                                           CHECK (family_code ~ '^FAM-\d{4}-\d{5}$'),
    head_document            VARCHAR(30)   NOT NULL,
    zone_id                  BIGINT        NOT NULL REFERENCES zones(id)    ON DELETE RESTRICT,
    shelter_id               BIGINT        REFERENCES shelters(id)          ON DELETE SET NULL,
    num_members              INTEGER       NOT NULL DEFAULT 1 CHECK (num_members > 0),
    num_children_under_5     INTEGER       NOT NULL DEFAULT 0 CHECK (num_children_under_5 >= 0),
    num_adults_over_65       INTEGER       NOT NULL DEFAULT 0 CHECK (num_adults_over_65   >= 0),
    num_pregnant             INTEGER       NOT NULL DEFAULT 0 CHECK (num_pregnant         >= 0),
    num_disabled             INTEGER       NOT NULL DEFAULT 0 CHECK (num_disabled         >= 0),
    priority_score           NUMERIC(10,3) NOT NULL DEFAULT 0,
    priority_score_breakdown JSONB,
    status                   family_status NOT NULL DEFAULT 'ACTIVO',
    latitude                 NUMERIC(9,6),
    longitude                NUMERIC(9,6),
    reference_address        VARCHAR(255),
    created_at               TIMESTAMP(3)  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP(3)  NOT NULL DEFAULT now()
);
CREATE INDEX families_head_doc_idx       ON families (head_document);
CREATE INDEX families_zone_status_idx    ON families (zone_id, status);
CREATE INDEX families_priority_idx       ON families (priority_score DESC);
CREATE INDEX families_ref_addr_trgm_idx  ON families USING gin (reference_address gin_trgm_ops);
CREATE TRIGGER families_set_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T8. PERSONS ──────────────────────────────────────────────────────────────
CREATE TABLE persons (
    id                   BIGSERIAL PRIMARY KEY,
    family_id            BIGINT       NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
    name                 VARCHAR(120) NOT NULL,
    document             VARCHAR(30)  NOT NULL UNIQUE,
    birth_date           DATE         NOT NULL,
    gender               CHAR(1)      NOT NULL CHECK (gender IN ('M','F','O')),
    relationship         relationship NOT NULL,
    special_conditions   special_condition[] NOT NULL DEFAULT '{}',
    requires_medication  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX persons_family_idx ON persons (family_id);
CREATE TRIGGER persons_set_updated_at BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T9. PRIVACY_CONSENTS ─────────────────────────────────────────────────────
CREATE TABLE privacy_consents (
    id                  BIGSERIAL PRIMARY KEY,
    family_id           BIGINT       NOT NULL UNIQUE
                                     REFERENCES families(id) ON DELETE CASCADE,
    accepted_at         TIMESTAMP(3) NOT NULL DEFAULT now(),
    accepted_by_user_id BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    law_version         VARCHAR(40)  NOT NULL DEFAULT 'Ley 1581/2012',
    ip_address          INET
);


-- ── T12. INVENTORY ───────────────────────────────────────────────────────────
CREATE TABLE inventory (
    id                  BIGSERIAL PRIMARY KEY,
    warehouse_id        BIGINT        NOT NULL REFERENCES warehouses(id)     ON DELETE RESTRICT,
    resource_type_id    BIGINT        NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    available_quantity  INTEGER       NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    total_weight_kg     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_weight_kg    >= 0),
    batch               VARCHAR(60)   NOT NULL DEFAULT 'SIN_LOTE',
    expiration_date     DATE,
    created_at          TIMESTAMP(3)  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP(3)  NOT NULL DEFAULT now(),
    UNIQUE (warehouse_id, resource_type_id, batch)
);
CREATE INDEX inventory_expiration_idx
    ON inventory (expiration_date) WHERE expiration_date IS NOT NULL;
CREATE TRIGGER inventory_set_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T13. INVENTORY_ADJUSTMENTS ───────────────────────────────────────────────
CREATE TABLE inventory_adjustments (
    id           BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT             NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    delta        INTEGER            NOT NULL CHECK (delta <> 0),
    reason       adjustment_reason  NOT NULL,
    reason_note  VARCHAR(255)       NOT NULL,
    user_id      BIGINT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at   TIMESTAMP(3)       NOT NULL DEFAULT now()
);


-- ── T14. DONORS ──────────────────────────────────────────────────────────────
CREATE TABLE donors (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    type       donor_type   NOT NULL,
    contact    VARCHAR(120) NOT NULL,
    tax_id     VARCHAR(40)  UNIQUE,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
    UNIQUE (name, type)
);
CREATE TRIGGER donors_set_updated_at BEFORE UPDATE ON donors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T15. DONATIONS ───────────────────────────────────────────────────────────
CREATE TABLE donations (
    id                       BIGSERIAL PRIMARY KEY,
    donation_code            VARCHAR(20)   NOT NULL UNIQUE
                                           CHECK (donation_code ~ '^DON-\d{4}-\d{5}$'),
    donor_id                 BIGINT        NOT NULL REFERENCES donors(id)     ON DELETE RESTRICT,
    destination_warehouse_id BIGINT        NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    donation_type            donation_type NOT NULL,
    monetary_amount          NUMERIC(14,2) CHECK (monetary_amount IS NULL OR monetary_amount >= 0),
    date                     TIMESTAMP(3)  NOT NULL DEFAULT now(),
    created_at               TIMESTAMP(3)  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP(3)  NOT NULL DEFAULT now(),
    CONSTRAINT donations_monetary_required CHECK (
        donation_type <> 'MONETARY' OR monetary_amount IS NOT NULL
    )
);
CREATE INDEX donations_donor_date_idx ON donations (donor_id, date DESC);
CREATE TRIGGER donations_set_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T16. DONATION_DETAILS ────────────────────────────────────────────────────
CREATE TABLE donation_details (
    id               BIGSERIAL PRIMARY KEY,
    donation_id      BIGINT        NOT NULL REFERENCES donations(id)      ON DELETE CASCADE,
    resource_type_id BIGINT        NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    quantity         INTEGER       NOT NULL CHECK (quantity > 0),
    weight_kg        NUMERIC(10,2) NOT NULL CHECK (weight_kg >= 0),
    UNIQUE (donation_id, resource_type_id)
);


-- ── T17. DISTRIBUTION_PLANS ──────────────────────────────────────────────────
CREATE TABLE distribution_plans (
    id          BIGSERIAL PRIMARY KEY,
    plan_code   VARCHAR(20)  NOT NULL UNIQUE
                             CHECK (plan_code ~ '^PLN-\d{4}-\d{5}$'),
    created_by  BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status      plan_status  NOT NULL DEFAULT 'PROGRAMADA',
    scope       plan_scope   NOT NULL DEFAULT 'GLOBAL',
    scope_id    BIGINT,
    notes       TEXT,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT plans_scope_id_required CHECK (
        (scope = 'GLOBAL' AND scope_id IS NULL)
     OR (scope <> 'GLOBAL' AND scope_id IS NOT NULL)
    )
);
CREATE TRIGGER distribution_plans_set_updated_at BEFORE UPDATE ON distribution_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T19. DELIVERIES (creada antes de DISTRIBUTION_PLAN_ITEMS por FK delivery_id) ──
CREATE TABLE deliveries (
    id                       BIGSERIAL PRIMARY KEY,
    delivery_code            VARCHAR(20)  NOT NULL UNIQUE
                                          CHECK (delivery_code ~ '^ENT-\d{4}-\d{5}$'),
    family_id                BIGINT       NOT NULL REFERENCES families(id)   ON DELETE RESTRICT,
    source_warehouse_id      BIGINT       NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    delivered_by             BIGINT       NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
    exception_authorized_by  BIGINT       REFERENCES users(id)               ON DELETE RESTRICT,
    exception_reason         VARCHAR(255),
    delivery_date            TIMESTAMP(3) NOT NULL DEFAULT now(),
    coverage_days            INTEGER      NOT NULL CHECK (coverage_days >= 3),
    status                   delivery_status NOT NULL DEFAULT 'PROGRAMADA',
    received_by_document     VARCHAR(30)  NOT NULL,
    delivery_latitude        NUMERIC(9,6) NOT NULL,
    delivery_longitude       NUMERIC(9,6) NOT NULL,
    client_op_id             VARCHAR(50)  UNIQUE,
    created_at               TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT deliveries_exception_pair CHECK (
        (exception_reason IS NULL AND exception_authorized_by IS NULL)
     OR (exception_reason IS NOT NULL AND exception_authorized_by IS NOT NULL)
    )
);
CREATE INDEX deliveries_family_date_idx ON deliveries (family_id, delivery_date DESC);
CREATE INDEX deliveries_status_idx      ON deliveries (status);
CREATE TRIGGER deliveries_set_updated_at BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T18. DISTRIBUTION_PLAN_ITEMS ─────────────────────────────────────────────
CREATE TABLE distribution_plan_items (
    id                   BIGSERIAL PRIMARY KEY,
    plan_id              BIGINT           NOT NULL REFERENCES distribution_plans(id) ON DELETE CASCADE,
    family_id            BIGINT           NOT NULL REFERENCES families(id)           ON DELETE RESTRICT,
    source_warehouse_id  BIGINT           NOT NULL REFERENCES warehouses(id)         ON DELETE RESTRICT,
    target_coverage_days INTEGER          NOT NULL CHECK (target_coverage_days >= 3),
    status               plan_item_status NOT NULL DEFAULT 'PENDIENTE',
    delivery_id          BIGINT UNIQUE    REFERENCES deliveries(id)                  ON DELETE SET NULL,
    UNIQUE (plan_id, family_id)
);


-- ── T20. DELIVERY_DETAILS ────────────────────────────────────────────────────
CREATE TABLE delivery_details (
    id               BIGSERIAL PRIMARY KEY,
    delivery_id      BIGINT        NOT NULL REFERENCES deliveries(id)      ON DELETE CASCADE,
    resource_type_id BIGINT        NOT NULL REFERENCES resource_types(id)  ON DELETE RESTRICT,
    quantity         INTEGER       NOT NULL CHECK (quantity > 0),
    weight_kg        NUMERIC(10,2) NOT NULL CHECK (weight_kg >= 0),
    UNIQUE (delivery_id, resource_type_id)
);


-- ── T21. HEALTH_VECTORS ──────────────────────────────────────────────────────
CREATE TABLE health_vectors (
    id            BIGSERIAL PRIMARY KEY,
    vector_type   vector_type   NOT NULL,
    risk_level    risk_level    NOT NULL,
    status        vector_status NOT NULL DEFAULT 'ACTIVO',
    actions_taken TEXT          NOT NULL,
    latitude      NUMERIC(9,6)  NOT NULL,
    longitude     NUMERIC(9,6)  NOT NULL,
    zone_id       BIGINT        REFERENCES zones(id)    ON DELETE SET NULL,
    shelter_id    BIGINT        REFERENCES shelters(id) ON DELETE SET NULL,
    reported_by   BIGINT        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reported_date TIMESTAMP(3)  NOT NULL DEFAULT now(),
    created_at    TIMESTAMP(3)  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(3)  NOT NULL DEFAULT now(),
    CONSTRAINT vectors_geo_required CHECK (zone_id IS NOT NULL OR shelter_id IS NOT NULL)
);
CREATE INDEX vectors_zone_idx    ON health_vectors (zone_id);
CREATE INDEX vectors_shelter_idx ON health_vectors (shelter_id);
CREATE TRIGGER health_vectors_set_updated_at BEFORE UPDATE ON health_vectors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── T22. RELOCATIONS ─────────────────────────────────────────────────────────
CREATE TABLE relocations (
    id                     BIGSERIAL PRIMARY KEY,
    family_id              BIGINT          NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
    origin_shelter_id      BIGINT          NOT NULL REFERENCES shelters(id) ON DELETE RESTRICT,
    destination_shelter_id BIGINT          NOT NULL REFERENCES shelters(id) ON DELETE RESTRICT,
    type                   relocation_type NOT NULL,
    relocation_date        TIMESTAMP(3)    NOT NULL DEFAULT now(),
    reason                 VARCHAR(255)    NOT NULL,
    authorized_by          BIGINT          NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    created_at             TIMESTAMP(3)    NOT NULL DEFAULT now(),
    CONSTRAINT relocations_distinct_shelters CHECK (origin_shelter_id <> destination_shelter_id)
);


-- =============================================================================
-- ## 5. AUDITORÍA INALTERABLE (RNF-09, HU-31, CV-11)
-- =============================================================================

-- 5.1 Trigger BEFORE UPDATE/DELETE — bloquea cualquier mutación posterior.
CREATE OR REPLACE FUNCTION trg_audit_log_readonly_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'SH403';
END $$;

CREATE TRIGGER trg_audit_log_readonly
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log_readonly_fn();

-- 5.2 Inserción de auditoría — invocada por todos los SP de mutación.
CREATE OR REPLACE FUNCTION sp_audit_insert(
    p_action     TEXT,
    p_module     TEXT,
    p_entity     TEXT,
    p_entity_id  BIGINT,
    p_user_id    BIGINT,
    p_before     JSONB,
    p_after      JSONB,
    p_ip         INET,
    p_user_agent TEXT
) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO audit_logs
        (action, module, entity, entity_id, user_id, before, after, ip_address, user_agent)
    VALUES
        (p_action, p_module, p_entity, p_entity_id, p_user_id, p_before, p_after, p_ip, p_user_agent);
$$;


-- =============================================================================
-- ## 6. TRIGGERS DE REGLAS DE NEGOCIO
-- =============================================================================

-- 6.1 Generadores de código (RN-07) — disparan ANTES de INSERT cuando el código
-- viene NULL. Esto permite que sp_<entidad>_create lo asigne explícitamente o
-- delegue al trigger.
CREATE OR REPLACE FUNCTION trg_family_code_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.family_code IS NULL OR NEW.family_code = '' THEN
        NEW.family_code := fn_next_code('FAM');
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_family_code BEFORE INSERT ON families
    FOR EACH ROW EXECUTE FUNCTION trg_family_code_fn();

CREATE OR REPLACE FUNCTION trg_donation_code_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.donation_code IS NULL OR NEW.donation_code = '' THEN
        NEW.donation_code := fn_next_code('DON');
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_donation_code BEFORE INSERT ON donations
    FOR EACH ROW EXECUTE FUNCTION trg_donation_code_fn();

CREATE OR REPLACE FUNCTION trg_delivery_code_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.delivery_code IS NULL OR NEW.delivery_code = '' THEN
        NEW.delivery_code := fn_next_code('ENT');
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_delivery_code BEFORE INSERT ON deliveries
    FOR EACH ROW EXECUTE FUNCTION trg_delivery_code_fn();

CREATE OR REPLACE FUNCTION trg_plan_code_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.plan_code IS NULL OR NEW.plan_code = '' THEN
        NEW.plan_code := fn_next_code('PLN');
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_plan_code BEFORE INSERT ON distribution_plans
    FOR EACH ROW EXECUTE FUNCTION trg_plan_code_fn();


-- 6.2 Composición familiar — recálculo de agregados al cambiar PERSONS.
--     Cumple RN-08 y HU-05 CA5 / HU-07 CA4.
CREATE OR REPLACE FUNCTION trg_family_composition_sync_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_family_id BIGINT := COALESCE(NEW.family_id, OLD.family_id);
BEGIN
    UPDATE families f
       SET num_members = (SELECT count(*)
                            FROM persons WHERE family_id = v_family_id),
           num_children_under_5 = (SELECT count(*) FROM persons
                                    WHERE family_id = v_family_id
                                      AND 'CHILD_UNDER_5' = ANY(special_conditions)),
           num_adults_over_65   = (SELECT count(*) FROM persons
                                    WHERE family_id = v_family_id
                                      AND 'ELDERLY_OVER_65' = ANY(special_conditions)),
           num_pregnant         = (SELECT count(*) FROM persons
                                    WHERE family_id = v_family_id
                                      AND 'PREGNANT' = ANY(special_conditions)),
           num_disabled         = (SELECT count(*) FROM persons
                                    WHERE family_id = v_family_id
                                      AND 'DISABLED' = ANY(special_conditions))
     WHERE f.id = v_family_id;

    -- recálculo de score (función definida más abajo, llamada perezosamente)
    PERFORM fn_priority_score_recalc(v_family_id);
    RETURN NULL;
END $$;

CREATE TRIGGER trg_family_composition_sync
    AFTER INSERT OR UPDATE OR DELETE ON persons
    FOR EACH ROW EXECUTE FUNCTION trg_family_composition_sync_fn();


-- 6.3 Bloqueo del último miembro (HU-07 CA2).
CREATE OR REPLACE FUNCTION trg_prevent_last_member_delete_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
    v_status family_status;
BEGIN
    SELECT count(*), max(f.status::TEXT)::family_status
      INTO v_count, v_status
      FROM persons p
      JOIN families f ON f.id = p.family_id
     WHERE p.family_id = OLD.family_id;

    IF v_count <= 1 AND v_status = 'ACTIVO' THEN
        RAISE EXCEPTION 'Cannot delete the last member of an active family'
              USING ERRCODE = 'SH422';
    END IF;
    RETURN OLD;
END $$;

CREATE TRIGGER trg_prevent_last_member_delete
    BEFORE DELETE ON persons
    FOR EACH ROW EXECUTE FUNCTION trg_prevent_last_member_delete_fn();


-- 6.4 Inventario: incremento por donación (RF-19, HU-19 CA4).
CREATE OR REPLACE FUNCTION trg_donation_inventory_increment_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_warehouse_id  BIGINT;
    v_capacity      NUMERIC(10,2);
    v_current       NUMERIC(10,2);
BEGIN
    SELECT d.destination_warehouse_id INTO v_warehouse_id
      FROM donations d WHERE d.id = NEW.donation_id;

    -- RN-03: bloquear si excede capacidad.
    SELECT max_capacity_kg, current_weight_kg
      INTO v_capacity, v_current
      FROM warehouses WHERE id = v_warehouse_id FOR UPDATE;

    IF v_current + NEW.weight_kg > v_capacity THEN
        RAISE EXCEPTION 'Warehouse capacity exceeded' USING ERRCODE = 'SH422';
    END IF;

    -- Upsert en inventory (lote SIN_LOTE por defecto).
    INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg)
    VALUES (v_warehouse_id, NEW.resource_type_id, NEW.quantity, NEW.weight_kg)
    ON CONFLICT (warehouse_id, resource_type_id, batch)
    DO UPDATE SET available_quantity = inventory.available_quantity + EXCLUDED.available_quantity,
                  total_weight_kg    = inventory.total_weight_kg    + EXCLUDED.total_weight_kg;

    UPDATE warehouses SET current_weight_kg = v_current + NEW.weight_kg
     WHERE id = v_warehouse_id;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_donation_inventory_increment
    AFTER INSERT ON donation_details
    FOR EACH ROW EXECUTE FUNCTION trg_donation_inventory_increment_fn();


-- 6.5 Inventario: decremento por entrega (RF-27, RN-05).
CREATE OR REPLACE FUNCTION trg_delivery_inventory_decrement_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_warehouse_id BIGINT;
    v_inv_id       BIGINT;
    v_available    INTEGER;
BEGIN
    SELECT d.source_warehouse_id INTO v_warehouse_id
      FROM deliveries d WHERE d.id = NEW.delivery_id;

    SELECT id, available_quantity INTO v_inv_id, v_available
      FROM inventory
     WHERE warehouse_id = v_warehouse_id
       AND resource_type_id = NEW.resource_type_id
     ORDER BY (expiration_date IS NULL), expiration_date ASC, id ASC
     LIMIT 1
     FOR UPDATE;

    IF v_inv_id IS NULL OR v_available < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for resource %', NEW.resource_type_id
              USING ERRCODE = 'SH422';
    END IF;

    UPDATE inventory
       SET available_quantity = available_quantity - NEW.quantity,
           total_weight_kg    = GREATEST(total_weight_kg - NEW.weight_kg, 0)
     WHERE id = v_inv_id;

    UPDATE warehouses
       SET current_weight_kg = GREATEST(current_weight_kg - NEW.weight_kg, 0)
     WHERE id = v_warehouse_id;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_delivery_inventory_decrement
    AFTER INSERT ON delivery_details
    FOR EACH ROW EXECUTE FUNCTION trg_delivery_inventory_decrement_fn();


-- 6.6 Ajustes manuales — valida que no quede negativo (HU-17 CA3).
CREATE OR REPLACE FUNCTION trg_inventory_adjustment_apply_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_available INTEGER;
BEGIN
    SELECT available_quantity INTO v_available
      FROM inventory WHERE id = NEW.inventory_id FOR UPDATE;

    IF v_available IS NULL THEN
        RAISE EXCEPTION 'Inventory % not found', NEW.inventory_id USING ERRCODE = 'SH404';
    END IF;
    IF v_available + NEW.delta < 0 THEN
        RAISE EXCEPTION 'Adjustment would leave negative stock' USING ERRCODE = 'SH422';
    END IF;

    UPDATE inventory
       SET available_quantity = available_quantity + NEW.delta
     WHERE id = NEW.inventory_id;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_adjustment_apply
    AFTER INSERT ON inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION trg_inventory_adjustment_apply_fn();


-- 6.7 Reubicaciones — actualiza ocupación de ambos refugios y family.shelter_id
-- (HU-24 CA3). Bloquea si la capacidad destino se excede.
CREATE OR REPLACE FUNCTION trg_relocation_apply_fn() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_dest_capacity  INTEGER;
    v_dest_occupancy INTEGER;
BEGIN
    SELECT max_capacity, current_occupancy
      INTO v_dest_capacity, v_dest_occupancy
      FROM shelters WHERE id = NEW.destination_shelter_id FOR UPDATE;

    IF v_dest_occupancy + 1 > v_dest_capacity THEN
        RAISE EXCEPTION 'Destination shelter is full' USING ERRCODE = 'SH422';
    END IF;

    UPDATE shelters SET current_occupancy = current_occupancy - 1
     WHERE id = NEW.origin_shelter_id AND current_occupancy > 0;
    UPDATE shelters SET current_occupancy = current_occupancy + 1
     WHERE id = NEW.destination_shelter_id;

    UPDATE families SET shelter_id = NEW.destination_shelter_id
     WHERE id = NEW.family_id;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_relocation_apply
    AFTER INSERT ON relocations
    FOR EACH ROW EXECUTE FUNCTION trg_relocation_apply_fn();


-- =============================================================================
-- ## 7. PRIORIZACIÓN (RN-04, RN-08, HU-08)
-- =============================================================================

-- Lee un peso de scoring_config; si la clave no existe, retorna p_default.
CREATE OR REPLACE FUNCTION fn_scoring_weight(p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
             (SELECT value FROM scoring_config WHERE key = p_key),
             p_default
           );
$$;

-- Calcula el puntaje de prioridad de una familia y retorna (score, breakdown).
CREATE OR REPLACE FUNCTION fn_priority_score(p_family_id BIGINT)
RETURNS TABLE (score NUMERIC, breakdown JSONB)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    f               families%ROWTYPE;
    z               zones%ROWTYPE;
    v_zone_factor   NUMERIC;
    v_days_no_aid   NUMERIC;
    v_deliveries    INTEGER;
    v_max_days      NUMERIC;
    w_members       NUMERIC;
    w_children_5    NUMERIC;
    w_adults_65     NUMERIC;
    w_pregnant      NUMERIC;
    w_disabled      NUMERIC;
    w_zone_risk     NUMERIC;
    w_days_no_aid   NUMERIC;
    w_deliveries    NUMERIC;
    v_total         NUMERIC;
    v_breakdown     JSONB;
    v_last_delivery TIMESTAMP(3);
BEGIN
    SELECT * INTO f FROM families WHERE id = p_family_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    SELECT * INTO z FROM zones WHERE id = f.zone_id;

    w_members     := fn_scoring_weight('W_MEMBERS',     2);
    w_children_5  := fn_scoring_weight('W_CHILDREN_5',  5);
    w_adults_65   := fn_scoring_weight('W_ADULTS_65',   4);
    w_pregnant    := fn_scoring_weight('W_PREGNANT',    5);
    w_disabled    := fn_scoring_weight('W_DISABLED',    4);
    w_zone_risk   := fn_scoring_weight('W_ZONE_RISK',   3);
    w_days_no_aid := fn_scoring_weight('W_DAYS_NO_AID', 1.5);
    w_deliveries  := fn_scoring_weight('W_DELIVERIES',  2);
    v_max_days    := fn_scoring_weight('MAX_DAYS',      30);

    v_zone_factor := CASE z.risk_level
                        WHEN 'LOW'      THEN 1
                        WHEN 'MEDIUM'   THEN 2
                        WHEN 'HIGH'     THEN 3
                        WHEN 'CRITICAL' THEN 4
                        ELSE 0 END;

    SELECT max(delivery_date), count(*)
      INTO v_last_delivery, v_deliveries
      FROM deliveries WHERE family_id = p_family_id;

    v_days_no_aid := LEAST(
        COALESCE(EXTRACT(DAY FROM (now() - v_last_delivery)), v_max_days),
        v_max_days
    );

    v_total :=   w_members     * f.num_members
               + w_children_5  * f.num_children_under_5
               + w_adults_65   * f.num_adults_over_65
               + w_pregnant    * f.num_pregnant
               + w_disabled    * f.num_disabled
               + w_zone_risk   * v_zone_factor
               + w_days_no_aid * v_days_no_aid
               - w_deliveries  * v_deliveries;

    v_breakdown := jsonb_build_object(
        'members',     w_members     * f.num_members,
        'children_5',  w_children_5  * f.num_children_under_5,
        'adults_65',   w_adults_65   * f.num_adults_over_65,
        'pregnant',    w_pregnant    * f.num_pregnant,
        'disabled',    w_disabled    * f.num_disabled,
        'zone_risk',   w_zone_risk   * v_zone_factor,
        'days_no_aid', w_days_no_aid * v_days_no_aid,
        'deliveries',  -1 * w_deliveries * v_deliveries
    );

    score := v_total;
    breakdown := v_breakdown;
    RETURN NEXT;
END $$;

-- Recalcula y persiste score+breakdown en families. Idempotente.
CREATE OR REPLACE FUNCTION fn_priority_score_recalc(p_family_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_score     NUMERIC;
    v_breakdown JSONB;
BEGIN
    SELECT score, breakdown INTO v_score, v_breakdown
      FROM fn_priority_score(p_family_id);
    UPDATE families
       SET priority_score = COALESCE(v_score, 0),
           priority_score_breakdown = v_breakdown
     WHERE id = p_family_id;
END $$;


-- =============================================================================
-- ## 8. STORED PROCEDURES — USERS / AUTH (HU-01, HU-02, HU-03)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_users_find_by_email(p_email TEXT)
RETURNS SETOF users LANGUAGE sql STABLE AS $$
    SELECT * FROM users WHERE email = p_email LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_users_find_by_id(p_id BIGINT)
RETURNS SETOF users LANGUAGE sql STABLE AS $$
    SELECT * FROM users WHERE id = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_users_list(
    p_role role, p_search TEXT, p_limit INTEGER, p_offset INTEGER
) RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT u.* FROM users u
         WHERE (p_role   IS NULL OR u.role = p_role)
           AND (p_search IS NULL OR u.email ILIKE '%' || p_search || '%'
                                  OR u.name  ILIKE '%' || p_search || '%')
    ),
    page AS (
        SELECT * FROM filtered ORDER BY id LIMIT p_limit OFFSET p_offset
    )
    SELECT
        COALESCE(jsonb_agg(to_jsonb(p) - 'password_hash' ORDER BY p.id), '[]'::jsonb),
        (SELECT count(*) FROM filtered)
      FROM page p;
$$;

CREATE OR REPLACE FUNCTION fn_users_create(
    p_email TEXT, p_name TEXT, p_password_hash TEXT, p_role role
) RETURNS users
LANGUAGE plpgsql AS $$
DECLARE v_user users;
BEGIN
    BEGIN
        INSERT INTO users (email, name, password_hash, role)
        VALUES (p_email, p_name, p_password_hash, p_role)
        RETURNING * INTO v_user;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Email already registered' USING ERRCODE = 'SH409';
    END;
    RETURN v_user;
END $$;

CREATE OR REPLACE FUNCTION sp_users_change_password(
    p_id BIGINT, p_new_password_hash TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users
       SET password_hash = p_new_password_hash,
           password_must_change = FALSE
     WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION sp_users_reset_password(
    p_id BIGINT, p_temp_hash TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users
       SET password_hash = p_temp_hash,
           password_must_change = TRUE,
           failed_login_attempts = 0,
           locked_until = NULL
     WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION sp_users_set_active(
    p_id BIGINT, p_is_active BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users SET is_active = p_is_active WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'SH404';
    END IF;
END $$;

-- Login con lockout (HU-02 CA5): 5 intentos → bloqueo 15 minutos.
-- La verificación de bcrypt se hace en Node antes de invocar este SP cuando
-- p_credentials_ok=TRUE; si las credenciales son inválidas, Node llama con
-- p_credentials_ok=FALSE para que aquí se incremente el contador.
CREATE OR REPLACE FUNCTION sp_auth_login(
    p_email TEXT, p_credentials_ok BOOLEAN
) RETURNS users
LANGUAGE plpgsql AS $$
DECLARE
    v_user users;
BEGIN
    SELECT * INTO v_user FROM users WHERE email = p_email;
    IF NOT FOUND OR NOT v_user.is_active THEN
        RAISE EXCEPTION 'Invalid credentials' USING ERRCODE = 'SH401';
    END IF;

    IF v_user.locked_until IS NOT NULL AND v_user.locked_until > now() THEN
        RAISE EXCEPTION 'Account locked' USING ERRCODE = 'SH423';
    END IF;

    IF NOT p_credentials_ok THEN
        UPDATE users
           SET failed_login_attempts = failed_login_attempts + 1,
               locked_until = CASE WHEN failed_login_attempts + 1 >= 5
                                   THEN now() + interval '15 minutes'
                                   ELSE NULL END
         WHERE id = v_user.id
        RETURNING * INTO v_user;
        RAISE EXCEPTION 'Invalid credentials' USING ERRCODE = 'SH401';
    END IF;

    UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = now()
     WHERE id = v_user.id
    RETURNING * INTO v_user;

    RETURN v_user;
END $$;


-- =============================================================================
-- ## 9. STORED PROCEDURES — ZONES (RF-08, HU-09)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_zones_create(
    p_name TEXT, p_risk_level risk_level,
    p_latitude NUMERIC, p_longitude NUMERIC, p_estimated_population INTEGER
) RETURNS zones
LANGUAGE plpgsql AS $$
DECLARE v_zone zones;
BEGIN
    BEGIN
        INSERT INTO zones (name, risk_level, latitude, longitude, estimated_population)
        VALUES (p_name, p_risk_level, p_latitude, p_longitude, p_estimated_population)
        RETURNING * INTO v_zone;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Zone name already exists' USING ERRCODE = 'SH409';
    END;
    RETURN v_zone;
END $$;

CREATE OR REPLACE FUNCTION fn_zones_find_by_id(p_id BIGINT)
RETURNS SETOF zones LANGUAGE sql STABLE AS $$
    SELECT * FROM zones WHERE id = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_zones_list(
    p_risk_level risk_level, p_search TEXT, p_limit INTEGER, p_offset INTEGER
) RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT z.* FROM zones z
         WHERE (p_risk_level IS NULL OR z.risk_level = p_risk_level)
           AND (p_search     IS NULL OR z.name ILIKE '%' || p_search || '%')
    ),
    page AS (SELECT * FROM filtered ORDER BY id LIMIT p_limit OFFSET p_offset)
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb),
           (SELECT count(*) FROM filtered)
      FROM page p;
$$;

CREATE OR REPLACE FUNCTION fn_zones_update(
    p_id BIGINT, p_name TEXT, p_risk_level risk_level,
    p_latitude NUMERIC, p_longitude NUMERIC, p_estimated_population INTEGER
) RETURNS zones
LANGUAGE plpgsql AS $$
DECLARE v_zone zones;
BEGIN
    BEGIN
        UPDATE zones
           SET name = COALESCE(p_name, name),
               risk_level = COALESCE(p_risk_level, risk_level),
               latitude = COALESCE(p_latitude, latitude),
               longitude = COALESCE(p_longitude, longitude),
               estimated_population = COALESCE(p_estimated_population, estimated_population)
         WHERE id = p_id
        RETURNING * INTO v_zone;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Zone name already exists' USING ERRCODE = 'SH409';
    END;
    IF v_zone.id IS NULL THEN
        RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
    END IF;
    RETURN v_zone;
END $$;

CREATE OR REPLACE FUNCTION sp_zones_delete(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM zones WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_zones_families(p_zone_id BIGINT)
RETURNS SETOF families LANGUAGE sql STABLE AS $$
    SELECT * FROM families WHERE zone_id = p_zone_id ORDER BY priority_score DESC;
$$;

CREATE OR REPLACE FUNCTION fn_zones_shelters(p_zone_id BIGINT)
RETURNS SETOF shelters LANGUAGE sql STABLE AS $$
    SELECT * FROM shelters WHERE zone_id = p_zone_id ORDER BY name;
$$;

CREATE OR REPLACE FUNCTION fn_zones_warehouses(p_zone_id BIGINT)
RETURNS SETOF warehouses LANGUAGE sql STABLE AS $$
    SELECT * FROM warehouses WHERE zone_id = p_zone_id ORDER BY name;
$$;


-- =============================================================================
-- ## 10. STORED PROCEDURES — SHELTERS (RF-09, HU-10)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_shelters_create(
    p_name TEXT, p_address TEXT, p_zone_id BIGINT, p_type shelter_type,
    p_max_capacity INTEGER, p_latitude NUMERIC, p_longitude NUMERIC
) RETURNS shelters
LANGUAGE plpgsql AS $$
DECLARE v_shelter shelters;
BEGIN
    BEGIN
        INSERT INTO shelters (name, address, zone_id, type, max_capacity, latitude, longitude)
        VALUES (p_name, p_address, p_zone_id, p_type, p_max_capacity, p_latitude, p_longitude)
        RETURNING * INTO v_shelter;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Shelter already exists in this zone' USING ERRCODE = 'SH409';
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Zone not found' USING ERRCODE = 'SH404';
    END;
    RETURN v_shelter;
END $$;

CREATE OR REPLACE FUNCTION fn_shelters_find_by_id(p_id BIGINT)
RETURNS SETOF shelters LANGUAGE sql STABLE AS $$
    SELECT * FROM shelters WHERE id = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_shelters_list(
    p_zone_id BIGINT, p_limit INTEGER, p_offset INTEGER
) RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT s.* FROM shelters s
         WHERE (p_zone_id IS NULL OR s.zone_id = p_zone_id)
    ),
    page AS (SELECT * FROM filtered ORDER BY id LIMIT p_limit OFFSET p_offset)
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb),
           (SELECT count(*) FROM filtered)
      FROM page p;
$$;

CREATE OR REPLACE FUNCTION sp_shelters_set_occupancy(
    p_id BIGINT, p_new_occupancy INTEGER
) RETURNS shelters
LANGUAGE plpgsql AS $$
DECLARE v_shelter shelters;
BEGIN
    UPDATE shelters SET current_occupancy = p_new_occupancy
     WHERE id = p_id RETURNING * INTO v_shelter;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shelter not found' USING ERRCODE = 'SH404';
    END IF;
    RETURN v_shelter;
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Occupancy out of range' USING ERRCODE = 'SH422';
END $$;


-- =============================================================================
-- ## 11. STORED PROCEDURES — WAREHOUSES (RF-10, RN-03, HU-11)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_warehouses_create(
    p_name TEXT, p_address TEXT, p_zone_id BIGINT,
    p_max_capacity_kg NUMERIC, p_latitude NUMERIC, p_longitude NUMERIC
) RETURNS warehouses
LANGUAGE plpgsql AS $$
DECLARE v_w warehouses;
BEGIN
    BEGIN
        INSERT INTO warehouses (name, address, zone_id, max_capacity_kg, latitude, longitude)
        VALUES (p_name, p_address, p_zone_id, p_max_capacity_kg, p_latitude, p_longitude)
        RETURNING * INTO v_w;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Warehouse name already exists' USING ERRCODE = 'SH409';
    END;
    RETURN v_w;
END $$;

CREATE OR REPLACE FUNCTION fn_warehouses_find_by_id(p_id BIGINT)
RETURNS SETOF warehouses LANGUAGE sql STABLE AS $$
    SELECT * FROM warehouses WHERE id = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_warehouses_list(
    p_zone_id BIGINT, p_status warehouse_status, p_limit INTEGER, p_offset INTEGER
) RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT w.* FROM warehouses w
         WHERE (p_zone_id IS NULL OR w.zone_id = p_zone_id)
           AND (p_status  IS NULL OR w.status  = p_status)
    ),
    page AS (SELECT * FROM filtered ORDER BY id LIMIT p_limit OFFSET p_offset)
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb),
           (SELECT count(*) FROM filtered)
      FROM page p;
$$;

-- Bodegas más cercanas a un punto (Haversine, sin PostGIS).
CREATE OR REPLACE FUNCTION fn_warehouses_nearest(
    p_lat NUMERIC, p_lng NUMERIC, p_limit INTEGER
) RETURNS TABLE (id BIGINT, name VARCHAR, distance_km NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT w.id, w.name,
           (6371 * acos(
               LEAST(1, GREATEST(-1,
                   cos(radians(p_lat)) * cos(radians(w.latitude))
                   * cos(radians(w.longitude) - radians(p_lng))
                 + sin(radians(p_lat)) * sin(radians(w.latitude))
               ))
           ))::NUMERIC(10,3) AS distance_km
      FROM warehouses w
     WHERE w.status = 'ACTIVE'
     ORDER BY distance_km ASC
     LIMIT p_limit;
$$;


-- =============================================================================
-- ## 12. STORED PROCEDURES — RESOURCE TYPES + INVENTORY + ALERTS
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_resource_types_create(
    p_name TEXT, p_category resource_category,
    p_unit TEXT, p_unit_weight NUMERIC
) RETURNS resource_types
LANGUAGE plpgsql AS $$
DECLARE v_rt resource_types;
BEGIN
    BEGIN
        INSERT INTO resource_types (name, category, unit_of_measure, unit_weight_kg)
        VALUES (p_name, p_category, p_unit, p_unit_weight)
        RETURNING * INTO v_rt;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Resource already registered (name+category)' USING ERRCODE = 'SH409';
    END;
    RETURN v_rt;
END $$;

CREATE OR REPLACE FUNCTION fn_resource_types_list(p_active BOOLEAN)
RETURNS SETOF resource_types LANGUAGE sql STABLE AS $$
    SELECT * FROM resource_types
     WHERE (p_active IS NULL OR is_active = p_active)
     ORDER BY category, name;
$$;

CREATE OR REPLACE FUNCTION sp_resource_types_set_active(
    p_id BIGINT, p_is_active BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE resource_types SET is_active = p_is_active WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resource type not found' USING ERRCODE = 'SH404';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_inventory_list(p_warehouse_id BIGINT)
RETURNS TABLE (
    id BIGINT, warehouse_id BIGINT, warehouse_name VARCHAR,
    resource_type_id BIGINT, resource_name VARCHAR, category resource_category,
    available_quantity INTEGER, total_weight_kg NUMERIC, batch VARCHAR,
    expiration_date DATE
) LANGUAGE sql STABLE AS $$
    SELECT i.id, i.warehouse_id, w.name, i.resource_type_id, r.name, r.category,
           i.available_quantity, i.total_weight_kg, i.batch, i.expiration_date
      FROM inventory i
      JOIN warehouses w     ON w.id = i.warehouse_id
      JOIN resource_types r ON r.id = i.resource_type_id
     WHERE (p_warehouse_id IS NULL OR i.warehouse_id = p_warehouse_id)
     ORDER BY w.name, r.category, r.name;
$$;

CREATE OR REPLACE FUNCTION fn_inventory_summary()
RETURNS TABLE (
    resource_type_id BIGINT, resource_name VARCHAR, category resource_category,
    total_quantity BIGINT, total_weight_kg NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT r.id, r.name, r.category,
           COALESCE(sum(i.available_quantity), 0)::BIGINT,
           COALESCE(sum(i.total_weight_kg),    0)
      FROM resource_types r
      LEFT JOIN inventory i ON i.resource_type_id = r.id
     GROUP BY r.id, r.name, r.category
     ORDER BY r.category, r.name;
$$;

CREATE OR REPLACE FUNCTION sp_inventory_adjust(
    p_inventory_id BIGINT, p_delta INTEGER,
    p_reason adjustment_reason, p_reason_note TEXT, p_user_id BIGINT
) RETURNS inventory_adjustments
LANGUAGE plpgsql AS $$
DECLARE v_adj inventory_adjustments;
BEGIN
    INSERT INTO inventory_adjustments
        (inventory_id, delta, reason, reason_note, user_id)
    VALUES
        (p_inventory_id, p_delta, p_reason, p_reason_note, p_user_id)
    RETURNING * INTO v_adj;

    PERFORM sp_audit_insert(
        'UPDATE', 'inventory', 'inventory_adjustments',
        v_adj.id, p_user_id, NULL,
        to_jsonb(v_adj), NULL, NULL
    );
    RETURN v_adj;
END $$;

CREATE OR REPLACE FUNCTION fn_inventory_alerts()
RETURNS TABLE (
    resource_type_id BIGINT, resource_name VARCHAR,
    available BIGINT, threshold INTEGER
) LANGUAGE sql STABLE AS $$
    SELECT r.id, r.name,
           COALESCE(sum(i.available_quantity), 0)::BIGINT AS available,
           t.min_quantity
      FROM resource_types r
      JOIN alert_thresholds t ON t.resource_type_id = r.id
      LEFT JOIN inventory   i ON i.resource_type_id = r.id
     GROUP BY r.id, r.name, t.min_quantity
    HAVING COALESCE(sum(i.available_quantity), 0) <= t.min_quantity;
$$;

CREATE OR REPLACE FUNCTION sp_alert_thresholds_set(
    p_resource_type_id BIGINT, p_min_quantity INTEGER, p_user_id BIGINT
) RETURNS alert_thresholds
LANGUAGE plpgsql AS $$
DECLARE v_t alert_thresholds;
BEGIN
    INSERT INTO alert_thresholds (resource_type_id, min_quantity, updated_by)
    VALUES (p_resource_type_id, p_min_quantity, p_user_id)
    ON CONFLICT (resource_type_id) DO UPDATE
       SET min_quantity = EXCLUDED.min_quantity,
           updated_by   = EXCLUDED.updated_by,
           updated_at   = now()
    RETURNING * INTO v_t;
    RETURN v_t;
END $$;


-- =============================================================================
-- ## 13. STORED PROCEDURES — DONORS / DONATIONS (RF-18..21)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_donors_create(
    p_name TEXT, p_type donor_type, p_contact TEXT, p_tax_id TEXT
) RETURNS donors
LANGUAGE plpgsql AS $$
DECLARE v_d donors;
BEGIN
    BEGIN
        INSERT INTO donors (name, type, contact, tax_id)
        VALUES (p_name, p_type, p_contact, p_tax_id)
        RETURNING * INTO v_d;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Donor already exists' USING ERRCODE = 'SH409';
    END;
    RETURN v_d;
END $$;

CREATE OR REPLACE FUNCTION fn_donors_list(
    p_type donor_type, p_search TEXT, p_limit INTEGER, p_offset INTEGER
) RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT * FROM donors
         WHERE (p_type   IS NULL OR type = p_type)
           AND (p_search IS NULL OR name ILIKE '%' || p_search || '%')
    ),
    page AS (SELECT * FROM filtered ORDER BY id LIMIT p_limit OFFSET p_offset)
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb),
           (SELECT count(*) FROM filtered)
      FROM page p;
$$;

-- Crea una donación (cabecera + detalles) atómicamente; el trigger
-- trg_donation_inventory_increment ajusta inventario y peso de bodega.
CREATE OR REPLACE FUNCTION sp_donations_create(
    p_donor_id BIGINT, p_warehouse_id BIGINT, p_type donation_type,
    p_monetary_amount NUMERIC, p_details JSONB, p_user_id BIGINT
) RETURNS donations
LANGUAGE plpgsql AS $$
DECLARE
    v_donation donations;
    v_item     JSONB;
BEGIN
    INSERT INTO donations (donor_id, destination_warehouse_id, donation_type, monetary_amount)
    VALUES (p_donor_id, p_warehouse_id, p_type, p_monetary_amount)
    RETURNING * INTO v_donation;

    IF p_type IN ('IN_KIND', 'MIXED') AND p_details IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_details)
        LOOP
            INSERT INTO donation_details (donation_id, resource_type_id, quantity, weight_kg)
            VALUES (
                v_donation.id,
                (v_item->>'resource_type_id')::BIGINT,
                (v_item->>'quantity')::INTEGER,
                (v_item->>'weight_kg')::NUMERIC
            );
        END LOOP;
    END IF;

    PERFORM sp_audit_insert(
        'CREATE', 'donations', 'donations', v_donation.id,
        p_user_id, NULL, to_jsonb(v_donation), NULL, NULL
    );
    RETURN v_donation;
END $$;

CREATE OR REPLACE FUNCTION fn_donations_by_donor(p_donor_id BIGINT)
RETURNS SETOF donations LANGUAGE sql STABLE AS $$
    SELECT * FROM donations WHERE donor_id = p_donor_id ORDER BY date DESC;
$$;


-- =============================================================================
-- ## 14. STORED PROCEDURES — FAMILIES / PERSONS / CONSENT (RF-01..07, RN-09)
-- =============================================================================

-- Crea familia y consentimiento en la misma transacción (RN-09).
CREATE OR REPLACE FUNCTION sp_families_create_with_consent(
    p_head_document TEXT, p_zone_id BIGINT, p_shelter_id BIGINT,
    p_latitude NUMERIC, p_longitude NUMERIC, p_reference_address TEXT,
    p_consent_accepted BOOLEAN, p_user_id BIGINT, p_ip INET
) RETURNS families
LANGUAGE plpgsql AS $$
DECLARE v_family families;
BEGIN
    IF NOT COALESCE(p_consent_accepted, FALSE) THEN
        RAISE EXCEPTION 'Privacy consent (Ley 1581/2012) is required' USING ERRCODE = 'SH422';
    END IF;

    INSERT INTO families (head_document, zone_id, shelter_id,
                          latitude, longitude, reference_address)
    VALUES (p_head_document, p_zone_id, p_shelter_id,
            p_latitude, p_longitude, p_reference_address)
    RETURNING * INTO v_family;

    INSERT INTO privacy_consents (family_id, accepted_by_user_id, ip_address)
    VALUES (v_family.id, p_user_id, p_ip);

    PERFORM sp_audit_insert(
        'CREATE', 'families', 'families', v_family.id,
        p_user_id, NULL, to_jsonb(v_family), p_ip, NULL
    );
    RETURN v_family;
END $$;

CREATE OR REPLACE FUNCTION fn_families_find_by_id(p_id BIGINT)
RETURNS SETOF families LANGUAGE sql STABLE AS $$
    SELECT * FROM families WHERE id = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_families_list(
    p_zone_id BIGINT, p_status family_status, p_limit INTEGER, p_offset INTEGER
) RETURNS TABLE (data JSONB, total BIGINT)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT f.* FROM families f
         WHERE (p_zone_id IS NULL OR f.zone_id = p_zone_id)
           AND (p_status  IS NULL OR f.status  = p_status)
    ),
    page AS (SELECT * FROM filtered ORDER BY priority_score DESC, id LIMIT p_limit OFFSET p_offset)
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.priority_score DESC), '[]'::jsonb),
           (SELECT count(*) FROM filtered)
      FROM page p;
$$;

-- Búsqueda unificada por code, head_document y reference_address (HU-06).
CREATE OR REPLACE FUNCTION fn_families_search(p_q TEXT, p_limit INTEGER)
RETURNS SETOF families LANGUAGE sql STABLE AS $$
    SELECT * FROM families
     WHERE family_code ILIKE '%' || p_q || '%'
        OR head_document ILIKE '%' || p_q || '%'
        OR reference_address ILIKE '%' || p_q || '%'
     ORDER BY priority_score DESC
     LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION fn_families_get_eligibility(p_family_id BIGINT)
RETURNS TABLE (eligible BOOLEAN, reason TEXT, last_delivery_date TIMESTAMP(3),
               coverage_until TIMESTAMP(3))
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_last  TIMESTAMP(3);
    v_until TIMESTAMP(3);
    v_days  INTEGER;
BEGIN
    SELECT delivery_date, coverage_days INTO v_last, v_days
      FROM deliveries WHERE family_id = p_family_id
     ORDER BY delivery_date DESC LIMIT 1;

    IF v_last IS NULL THEN
        eligible := TRUE;  reason := 'NEVER_DELIVERED';
        last_delivery_date := NULL; coverage_until := NULL;
        RETURN NEXT; RETURN;
    END IF;

    v_until := v_last + (v_days || ' days')::INTERVAL;
    IF v_until > now() THEN
        eligible := FALSE; reason := 'COVERAGE_ACTIVE';
    ELSE
        eligible := TRUE;  reason := 'COVERAGE_EXPIRED';
    END IF;
    last_delivery_date := v_last; coverage_until := v_until;
    RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION sp_families_update(
    p_id BIGINT, p_zone_id BIGINT, p_shelter_id BIGINT,
    p_latitude NUMERIC, p_longitude NUMERIC, p_reference_address TEXT,
    p_status family_status, p_user_id BIGINT
) RETURNS families
LANGUAGE plpgsql AS $$
DECLARE
    v_old families;
    v_new families;
BEGIN
    SELECT * INTO v_old FROM families WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'SH404';
    END IF;

    UPDATE families
       SET zone_id           = COALESCE(p_zone_id,           zone_id),
           shelter_id        = COALESCE(p_shelter_id,        shelter_id),
           latitude          = COALESCE(p_latitude,          latitude),
           longitude         = COALESCE(p_longitude,         longitude),
           reference_address = COALESCE(p_reference_address, reference_address),
           status            = COALESCE(p_status,            status)
     WHERE id = p_id RETURNING * INTO v_new;

    PERFORM sp_audit_insert(
        'UPDATE', 'families', 'families', p_id,
        p_user_id, to_jsonb(v_old), to_jsonb(v_new), NULL, NULL
    );
    RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION sp_persons_upsert_and_recalc(
    p_id BIGINT, p_family_id BIGINT, p_name TEXT, p_document TEXT,
    p_birth_date DATE, p_gender CHAR, p_relationship relationship,
    p_special_conditions special_condition[], p_requires_medication BOOLEAN
) RETURNS persons
LANGUAGE plpgsql AS $$
DECLARE v_person persons;
BEGIN
    IF p_id IS NULL THEN
        INSERT INTO persons (family_id, name, document, birth_date, gender,
                             relationship, special_conditions, requires_medication)
        VALUES (p_family_id, p_name, p_document, p_birth_date, p_gender,
                p_relationship,
                COALESCE(p_special_conditions, '{}'::special_condition[]),
                COALESCE(p_requires_medication, FALSE))
        RETURNING * INTO v_person;
    ELSE
        UPDATE persons
           SET name = COALESCE(p_name, name),
               document = COALESCE(p_document, document),
               birth_date = COALESCE(p_birth_date, birth_date),
               gender = COALESCE(p_gender, gender),
               relationship = COALESCE(p_relationship, relationship),
               special_conditions = COALESCE(p_special_conditions, special_conditions),
               requires_medication = COALESCE(p_requires_medication, requires_medication)
         WHERE id = p_id RETURNING * INTO v_person;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Person not found' USING ERRCODE = 'SH404';
        END IF;
    END IF;
    -- el trigger trg_family_composition_sync recalcula score automáticamente
    RETURN v_person;
END $$;

CREATE OR REPLACE FUNCTION sp_persons_delete(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM persons WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Person not found' USING ERRCODE = 'SH404';
    END IF;
    -- trg_prevent_last_member_delete y trg_family_composition_sync actúan en cascada
END $$;


-- =============================================================================
-- ## 15. STORED PROCEDURES — DELIVERIES (RF-24..29, RN-01/02/05/08)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_delivery_check_eligibility(p_family_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT eligible FROM fn_families_get_eligibility(p_family_id);
$$;

-- Entrega normal: valida elegibilidad, crea entrega + detalles.
-- Triggers se encargan de decremento de inventario y RN-03.
-- Soporta idempotencia vía p_client_op_id (UNIQUE en deliveries).
CREATE OR REPLACE FUNCTION sp_delivery_create(
    p_family_id BIGINT, p_warehouse_id BIGINT, p_delivered_by BIGINT,
    p_received_by_document TEXT, p_coverage_days INTEGER,
    p_latitude NUMERIC, p_longitude NUMERIC,
    p_details JSONB, p_client_op_id TEXT
) RETURNS deliveries
LANGUAGE plpgsql AS $$
DECLARE
    v_delivery deliveries;
    v_existing deliveries;
    v_eligible BOOLEAN;
    v_item     JSONB;
BEGIN
    IF p_client_op_id IS NOT NULL THEN
        SELECT * INTO v_existing FROM deliveries WHERE client_op_id = p_client_op_id;
        IF FOUND THEN RETURN v_existing; END IF;
    END IF;

    SELECT eligible INTO v_eligible FROM fn_families_get_eligibility(p_family_id);
    IF NOT v_eligible THEN
        RAISE EXCEPTION 'Family already has active coverage'
              USING ERRCODE = 'SH422';
    END IF;
    IF p_coverage_days < 3 THEN
        RAISE EXCEPTION 'Coverage must be >= 3 days' USING ERRCODE = 'SH422';
    END IF;

    INSERT INTO deliveries (
        family_id, source_warehouse_id, delivered_by,
        delivery_date, coverage_days, status, received_by_document,
        delivery_latitude, delivery_longitude, client_op_id
    ) VALUES (
        p_family_id, p_warehouse_id, p_delivered_by,
        now(), p_coverage_days, 'ENTREGADA', p_received_by_document,
        p_latitude, p_longitude, p_client_op_id
    ) RETURNING * INTO v_delivery;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_details)
    LOOP
        INSERT INTO delivery_details (delivery_id, resource_type_id, quantity, weight_kg)
        VALUES (
            v_delivery.id,
            (v_item->>'resource_type_id')::BIGINT,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'weight_kg')::NUMERIC
        );
    END LOOP;

    -- RN-08: recalcular score de la familia tras la entrega
    PERFORM fn_priority_score_recalc(p_family_id);

    PERFORM sp_audit_insert(
        'CREATE', 'deliveries', 'deliveries', v_delivery.id,
        p_delivered_by, NULL, to_jsonb(v_delivery), NULL, NULL
    );
    RETURN v_delivery;
END $$;

-- Entrega de excepción: ignora cobertura previa pero exige justificación
-- y autorizador (HU-23 CA5).
CREATE OR REPLACE FUNCTION sp_delivery_create_exception(
    p_family_id BIGINT, p_warehouse_id BIGINT, p_delivered_by BIGINT,
    p_received_by_document TEXT, p_coverage_days INTEGER,
    p_latitude NUMERIC, p_longitude NUMERIC, p_details JSONB,
    p_authorized_by BIGINT, p_reason TEXT
) RETURNS deliveries
LANGUAGE plpgsql AS $$
DECLARE
    v_delivery deliveries;
    v_item     JSONB;
BEGIN
    IF p_authorized_by IS NULL OR p_reason IS NULL THEN
        RAISE EXCEPTION 'Exception requires authorizer and reason' USING ERRCODE = 'SH422';
    END IF;
    IF p_coverage_days < 3 THEN
        RAISE EXCEPTION 'Coverage must be >= 3 days' USING ERRCODE = 'SH422';
    END IF;

    INSERT INTO deliveries (
        family_id, source_warehouse_id, delivered_by,
        exception_authorized_by, exception_reason,
        delivery_date, coverage_days, status, received_by_document,
        delivery_latitude, delivery_longitude
    ) VALUES (
        p_family_id, p_warehouse_id, p_delivered_by,
        p_authorized_by, p_reason,
        now(), p_coverage_days, 'ENTREGADA', p_received_by_document,
        p_latitude, p_longitude
    ) RETURNING * INTO v_delivery;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_details)
    LOOP
        INSERT INTO delivery_details (delivery_id, resource_type_id, quantity, weight_kg)
        VALUES (
            v_delivery.id,
            (v_item->>'resource_type_id')::BIGINT,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'weight_kg')::NUMERIC
        );
    END LOOP;

    PERFORM fn_priority_score_recalc(p_family_id);
    PERFORM sp_audit_insert(
        'CREATE_EXCEPTION', 'deliveries', 'deliveries', v_delivery.id,
        p_delivered_by, NULL, to_jsonb(v_delivery), NULL, NULL
    );
    RETURN v_delivery;
END $$;

CREATE OR REPLACE FUNCTION sp_delivery_set_status(
    p_id BIGINT, p_status delivery_status, p_user_id BIGINT
) RETURNS deliveries
LANGUAGE plpgsql AS $$
DECLARE
    v_old deliveries;
    v_new deliveries;
BEGIN
    SELECT * INTO v_old FROM deliveries WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'SH404';
    END IF;
    UPDATE deliveries SET status = p_status WHERE id = p_id RETURNING * INTO v_new;
    PERFORM sp_audit_insert(
        'STATUS_CHANGE', 'deliveries', 'deliveries', p_id,
        p_user_id, to_jsonb(v_old), to_jsonb(v_new), NULL, NULL
    );
    RETURN v_new;
END $$;


-- =============================================================================
-- ## 16. STORED PROCEDURES — DISTRIBUTION PLANS (HU-21)
-- =============================================================================

-- Genera un plan priorizado: toma las top N familias elegibles del scope,
-- las asocia al plan con cobertura mínima.
CREATE OR REPLACE FUNCTION sp_distribution_plan_generate(
    p_scope plan_scope, p_scope_id BIGINT,
    p_warehouse_id BIGINT, p_target_coverage_days INTEGER,
    p_limit INTEGER, p_user_id BIGINT, p_notes TEXT
) RETURNS distribution_plans
LANGUAGE plpgsql AS $$
DECLARE
    v_plan distribution_plans;
    v_family_id BIGINT;
BEGIN
    INSERT INTO distribution_plans (created_by, status, scope, scope_id, notes)
    VALUES (p_user_id, 'PROGRAMADA', p_scope, p_scope_id, p_notes)
    RETURNING * INTO v_plan;

    FOR v_family_id IN
        SELECT f.id FROM families f
         WHERE (p_scope = 'GLOBAL'
             OR (p_scope = 'ZONA'    AND f.zone_id    = p_scope_id)
             OR (p_scope = 'REFUGIO' AND f.shelter_id = p_scope_id))
           AND (SELECT eligible FROM fn_families_get_eligibility(f.id))
         ORDER BY f.priority_score DESC
         LIMIT p_limit
    LOOP
        INSERT INTO distribution_plan_items
            (plan_id, family_id, source_warehouse_id, target_coverage_days)
        VALUES
            (v_plan.id, v_family_id, p_warehouse_id, p_target_coverage_days)
        ON CONFLICT (plan_id, family_id) DO NOTHING;
    END LOOP;

    PERFORM sp_audit_insert(
        'CREATE', 'distribution_plans', 'distribution_plans', v_plan.id,
        p_user_id, NULL, to_jsonb(v_plan), NULL, NULL
    );
    RETURN v_plan;
END $$;

CREATE OR REPLACE FUNCTION sp_distribution_plan_cancel(
    p_id BIGINT, p_user_id BIGINT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE distribution_plans SET status = 'CANCELADA' WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'SH404';
    END IF;
    PERFORM sp_audit_insert(
        'CANCEL', 'distribution_plans', 'distribution_plans', p_id,
        p_user_id, NULL, NULL, NULL, NULL
    );
END $$;

CREATE OR REPLACE FUNCTION fn_distribution_plans_list(p_status plan_status)
RETURNS SETOF distribution_plans LANGUAGE sql STABLE AS $$
    SELECT * FROM distribution_plans
     WHERE (p_status IS NULL OR status = p_status)
     ORDER BY created_at DESC;
$$;


-- =============================================================================
-- ## 17. STORED PROCEDURES — PRIORITIZATION + SCORING CONFIG (HU-08)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_prioritization_ranking(p_limit INTEGER)
RETURNS TABLE (
    family_id BIGINT, family_code VARCHAR, head_document VARCHAR,
    zone_id BIGINT, priority_score NUMERIC, breakdown JSONB
) LANGUAGE sql STABLE AS $$
    SELECT id, family_code, head_document, zone_id,
           priority_score, priority_score_breakdown
      FROM families
     WHERE status = 'ACTIVO'
     ORDER BY priority_score DESC
     LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION fn_prioritization_next_batch(p_count INTEGER)
RETURNS SETOF families LANGUAGE sql STABLE AS $$
    SELECT f.* FROM families f
     WHERE f.status = 'ACTIVO'
       AND (SELECT eligible FROM fn_families_get_eligibility(f.id))
     ORDER BY f.priority_score DESC
     LIMIT p_count;
$$;

CREATE OR REPLACE FUNCTION sp_prioritization_recalculate_all()
RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_count BIGINT := 0;
    v_id    BIGINT;
BEGIN
    FOR v_id IN SELECT id FROM families LOOP
        PERFORM fn_priority_score_recalc(v_id);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION sp_scoring_config_set(
    p_key TEXT, p_value NUMERIC, p_user_id BIGINT
) RETURNS scoring_config
LANGUAGE plpgsql AS $$
DECLARE v_row scoring_config;
BEGIN
    INSERT INTO scoring_config (key, value, updated_by)
    VALUES (p_key, p_value, p_user_id)
    ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
    RETURNING * INTO v_row;

    -- Recalcula todo el padrón al cambiar un peso (RN-04, HU-08 CA5)
    PERFORM sp_prioritization_recalculate_all();
    RETURN v_row;
END $$;


-- =============================================================================
-- ## 18. STORED PROCEDURES — HEALTH VECTORS (HU-25, HU-26)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_health_vectors_create(
    p_vector_type vector_type, p_risk_level risk_level,
    p_actions TEXT, p_lat NUMERIC, p_lng NUMERIC,
    p_zone_id BIGINT, p_shelter_id BIGINT, p_reported_by BIGINT
) RETURNS health_vectors
LANGUAGE plpgsql AS $$
DECLARE v_v health_vectors;
BEGIN
    IF p_zone_id IS NULL AND p_shelter_id IS NULL THEN
        RAISE EXCEPTION 'Vector requires zone or shelter' USING ERRCODE = 'SH422';
    END IF;
    INSERT INTO health_vectors
        (vector_type, risk_level, actions_taken, latitude, longitude,
         zone_id, shelter_id, reported_by)
    VALUES
        (p_vector_type, p_risk_level, p_actions, p_lat, p_lng,
         p_zone_id, p_shelter_id, p_reported_by)
    RETURNING * INTO v_v;
    RETURN v_v;
END $$;

CREATE OR REPLACE FUNCTION fn_health_vectors_list(
    p_zone_id BIGINT, p_shelter_id BIGINT, p_status vector_status
) RETURNS SETOF health_vectors LANGUAGE sql STABLE AS $$
    SELECT * FROM health_vectors
     WHERE (p_zone_id    IS NULL OR zone_id    = p_zone_id)
       AND (p_shelter_id IS NULL OR shelter_id = p_shelter_id)
       AND (p_status     IS NULL OR status     = p_status)
     ORDER BY reported_date DESC;
$$;

CREATE OR REPLACE FUNCTION sp_health_vector_set_status(
    p_id BIGINT, p_status vector_status, p_user_id BIGINT
) RETURNS health_vectors
LANGUAGE plpgsql AS $$
DECLARE v_v health_vectors;
BEGIN
    UPDATE health_vectors SET status = p_status WHERE id = p_id RETURNING * INTO v_v;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vector not found' USING ERRCODE = 'SH404';
    END IF;
    PERFORM sp_audit_insert(
        'STATUS_CHANGE', 'health_vectors', 'health_vectors', p_id,
        p_user_id, NULL, to_jsonb(v_v), NULL, NULL
    );
    RETURN v_v;
END $$;


-- =============================================================================
-- ## 19. STORED PROCEDURES — RELOCATIONS (HU-24)
-- =============================================================================

-- El trigger trg_relocation_apply ajusta ocupación y family.shelter_id.
CREATE OR REPLACE FUNCTION sp_relocation_apply(
    p_family_id BIGINT, p_origin BIGINT, p_destination BIGINT,
    p_type relocation_type, p_reason TEXT, p_authorized_by BIGINT
) RETURNS relocations
LANGUAGE plpgsql AS $$
DECLARE v_r relocations;
BEGIN
    INSERT INTO relocations
        (family_id, origin_shelter_id, destination_shelter_id,
         type, reason, authorized_by)
    VALUES
        (p_family_id, p_origin, p_destination, p_type, p_reason, p_authorized_by)
    RETURNING * INTO v_r;

    PERFORM sp_audit_insert(
        'CREATE', 'relocations', 'relocations', v_r.id,
        p_authorized_by, NULL, to_jsonb(v_r), NULL, NULL
    );
    RETURN v_r;
END $$;


-- =============================================================================
-- ## 20. STORED PROCEDURES — REPORTS / MAP / DASHBOARD (HU-27..30)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_report_coverage()
RETURNS TABLE (
    zone_id BIGINT, zone_name VARCHAR, families_total BIGINT,
    families_covered BIGINT, coverage_pct NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT z.id, z.name,
           count(f.id)::BIGINT AS families_total,
           count(f.id) FILTER (WHERE NOT (SELECT eligible FROM fn_families_get_eligibility(f.id)))::BIGINT,
           CASE WHEN count(f.id) = 0 THEN 0
                ELSE ROUND(100.0 *
                     count(f.id) FILTER (WHERE NOT (SELECT eligible FROM fn_families_get_eligibility(f.id)))
                     / count(f.id), 2) END
      FROM zones z
      LEFT JOIN families f ON f.zone_id = z.id AND f.status = 'ACTIVO'
     GROUP BY z.id, z.name
     ORDER BY z.name;
$$;

CREATE OR REPLACE FUNCTION fn_report_inventory()
RETURNS SETOF RECORD LANGUAGE sql STABLE AS $$
    SELECT * FROM fn_inventory_summary();
$$;

CREATE OR REPLACE FUNCTION fn_report_donations_by_type()
RETURNS TABLE (
    type donation_type, total_donations BIGINT, total_monetary NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT donation_type, count(*)::BIGINT, COALESCE(sum(monetary_amount), 0)
      FROM donations GROUP BY donation_type;
$$;

CREATE OR REPLACE FUNCTION fn_report_deliveries_by_zone()
RETURNS TABLE (
    zone_id BIGINT, zone_name VARCHAR, total_deliveries BIGINT, total_kg NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT z.id, z.name, count(d.id)::BIGINT,
           COALESCE(sum(dd.weight_kg), 0)
      FROM zones z
      LEFT JOIN families         f  ON f.zone_id = z.id
      LEFT JOIN deliveries       d  ON d.family_id = f.id
      LEFT JOIN delivery_details dd ON dd.delivery_id = d.id
     GROUP BY z.id, z.name
     ORDER BY z.name;
$$;

CREATE OR REPLACE FUNCTION fn_report_zones_without_deliveries(p_days INTEGER)
RETURNS SETOF zones LANGUAGE sql STABLE AS $$
    SELECT z.* FROM zones z
     WHERE NOT EXISTS (
         SELECT 1 FROM deliveries d
           JOIN families f ON f.id = d.family_id
          WHERE f.zone_id = z.id
            AND d.delivery_date >= now() - (p_days || ' days')::INTERVAL
     );
$$;

CREATE OR REPLACE FUNCTION fn_report_unattended_families()
RETURNS SETOF families LANGUAGE sql STABLE AS $$
    SELECT f.* FROM families f
     WHERE f.status = 'ACTIVO'
       AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.family_id = f.id)
     ORDER BY f.priority_score DESC;
$$;

-- Trazabilidad recursiva donante → bodega → entrega → familia (RN-06, HU-29).
CREATE OR REPLACE FUNCTION fn_report_traceability(p_resource_type_id BIGINT)
RETURNS TABLE (
    donor_name VARCHAR, donation_code VARCHAR, donation_date TIMESTAMP(3),
    warehouse_name VARCHAR, delivery_code VARCHAR, family_code VARCHAR,
    quantity INTEGER, weight_kg NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT donor.name, don.donation_code, don.date,
           w.name, del.delivery_code, fam.family_code,
           dd.quantity, dd.weight_kg
      FROM delivery_details dd
      JOIN deliveries del   ON del.id = dd.delivery_id
      JOIN warehouses w     ON w.id = del.source_warehouse_id
      JOIN families   fam   ON fam.id = del.family_id
      LEFT JOIN donation_details ddet ON ddet.resource_type_id = dd.resource_type_id
      LEFT JOIN donations don         ON don.id = ddet.donation_id
                                      AND don.destination_warehouse_id = w.id
      LEFT JOIN donors    donor       ON donor.id = don.donor_id
     WHERE dd.resource_type_id = p_resource_type_id
     ORDER BY don.date DESC, del.delivery_date DESC;
$$;

CREATE OR REPLACE FUNCTION fn_dashboard_metrics()
RETURNS JSONB LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'families_total',     (SELECT count(*) FROM families WHERE status = 'ACTIVO'),
        'families_covered',   (SELECT count(*) FROM families f
                                WHERE NOT (SELECT eligible FROM fn_families_get_eligibility(f.id))),
        'shelters_total',     (SELECT count(*) FROM shelters),
        'shelters_occupancy', (SELECT COALESCE(sum(current_occupancy), 0) FROM shelters),
        'shelters_capacity',  (SELECT COALESCE(sum(max_capacity),       0) FROM shelters),
        'warehouses_total',   (SELECT count(*) FROM warehouses WHERE status = 'ACTIVE'),
        'warehouse_kg',       (SELECT COALESCE(sum(current_weight_kg),  0) FROM warehouses),
        'donations_total',    (SELECT count(*) FROM donations),
        'deliveries_total',   (SELECT count(*) FROM deliveries),
        'active_vectors',     (SELECT count(*) FROM health_vectors WHERE status = 'ACTIVO')
    );
$$;

CREATE OR REPLACE FUNCTION fn_map_shelters()
RETURNS TABLE (id BIGINT, name VARCHAR, type shelter_type,
               occupancy INTEGER, capacity INTEGER,
               latitude NUMERIC, longitude NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT id, name, type, current_occupancy, max_capacity, latitude, longitude
      FROM shelters;
$$;

CREATE OR REPLACE FUNCTION fn_map_warehouses()
RETURNS TABLE (id BIGINT, name VARCHAR, status warehouse_status,
               weight NUMERIC, capacity NUMERIC,
               latitude NUMERIC, longitude NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT id, name, status, current_weight_kg, max_capacity_kg, latitude, longitude
      FROM warehouses;
$$;

-- Sin datos sensibles (RNF-06): solo coords, estado, score.
CREATE OR REPLACE FUNCTION fn_map_families()
RETURNS TABLE (id BIGINT, family_code VARCHAR, status family_status,
               priority_score NUMERIC, latitude NUMERIC, longitude NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT id, family_code, status, priority_score, latitude, longitude
      FROM families
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION fn_map_vectors()
RETURNS TABLE (id BIGINT, vector_type vector_type, risk_level risk_level,
               status vector_status, latitude NUMERIC, longitude NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT id, vector_type, risk_level, status, latitude, longitude
      FROM health_vectors WHERE status <> 'RESUELTO';
$$;


-- =============================================================================
-- ## 21. AUDIT LIST + SYNC (RF-40, HU-31, RNF-08)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_list(
    p_user_id BIGINT, p_module TEXT, p_from TIMESTAMP, p_to TIMESTAMP,
    p_limit INTEGER, p_offset INTEGER
) RETURNS SETOF audit_logs LANGUAGE sql STABLE AS $$
    SELECT * FROM audit_logs
     WHERE (p_user_id IS NULL OR user_id    = p_user_id)
       AND (p_module  IS NULL OR module     = p_module)
       AND (p_from    IS NULL OR created_at >= p_from)
       AND (p_to      IS NULL OR created_at <= p_to)
     ORDER BY created_at DESC
     LIMIT p_limit OFFSET p_offset;
$$;

-- Sync offline: deduplica por client_op_id. Cada operación es atómica,
-- pero esta función solo despacha — la lógica vive en los SPs específicos.
CREATE OR REPLACE FUNCTION fn_sync_status(p_client_op_id TEXT)
RETURNS JSONB
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'client_op_id', p_client_op_id,
        'delivery',     (SELECT to_jsonb(d) FROM deliveries d
                          WHERE d.client_op_id = p_client_op_id LIMIT 1)
    );
$$;


-- =============================================================================
-- ## 22. SEEDS (datos iniciales, idempotentes)
-- =============================================================================

-- 22.1 Usuario sistema/seed (id=1) usado por scoring_config.updated_by inicial.
--     El admin "real" lo crea seed.ts con bcrypt; aquí dejamos un placeholder
--     desactivado para satisfacer la FK de scoring_config defaults.
INSERT INTO users (id, email, name, password_hash, role, is_active, password_must_change)
VALUES (1, 'system@sigah.local', 'system', '$2b$12$placeholderplaceholderplaceholderplaceholderplaceholder',
        'ADMIN', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT max(id) FROM users), 1));

-- 22.2 Pesos iniciales del scoring (PLAN.md §Prioritization Algorithm).
INSERT INTO scoring_config (key, value, updated_by) VALUES
    ('W_MEMBERS',     2,    1),
    ('W_CHILDREN_5',  5,    1),
    ('W_ADULTS_65',   4,    1),
    ('W_PREGNANT',    5,    1),
    ('W_DISABLED',    4,    1),
    ('W_ZONE_RISK',   3,    1),
    ('W_DAYS_NO_AID', 1.5,  1),
    ('W_DELIVERIES',  2,    1),
    ('MAX_DAYS',      30,   1)
ON CONFLICT (key) DO NOTHING;

-- 22.3 Zonas reales de Montería (margen izquierda, inundación 2026).
INSERT INTO zones (name, risk_level, latitude, longitude, estimated_population) VALUES
    ('Cantaclaro',              'CRITICAL', 8.732000, -75.896700, 18000),
    ('Robinson Pitalúa',        'HIGH',     8.741500, -75.901200, 12500),
    ('El Poblado',              'HIGH',     8.758900, -75.913400,  9800),
    ('Mogambo',                 'MEDIUM',   8.720300, -75.884500,  6200),
    ('Margen Izquierda Centro', 'CRITICAL', 8.749700, -75.905000, 22000)
ON CONFLICT (name) DO NOTHING;

-- 22.4 Catálogo mínimo de tipos de recurso (RF-13).
INSERT INTO resource_types (name, category, unit_of_measure, unit_weight_kg) VALUES
    ('Mercado básico (4 personas / 7 días)', 'FOOD',       'unidad', 16.800),
    ('Agua potable 1L',                       'FOOD',       'litro',   1.000),
    ('Cobija térmica',                        'BLANKET',    'unidad',  0.800),
    ('Colchoneta individual',                 'MATTRESS',   'unidad',  3.500),
    ('Kit de aseo',                           'HYGIENE',    'unidad',  1.200),
    ('Botiquín básico',                       'MEDICATION', 'unidad',  0.900)
ON CONFLICT (name, category) DO NOTHING;


-- =============================================================================
-- ## 23. ENDURECIMIENTO DE PERMISOS (audit append-only — RNF-09)
-- =============================================================================
-- Nota: si existe un rol de aplicación dedicado (p. ej. `app_user`), revoca
-- UPDATE/DELETE sobre audit_logs. El trigger trg_audit_log_readonly bloquea
-- igual a nivel fila, pero la revocación de permiso es defensa en profundidad.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        EXECUTE 'REVOKE UPDATE, DELETE ON audit_logs FROM app_user';
    END IF;
END $$;


-- =============================================================================
-- FIN — script de creación. Resumen:
--   · 22 tablas + code_counters
--   · 18 enums
--   · 11 triggers de RN (códigos, composición, inventario ↑/↓, ajustes,
--     reubicación, último miembro, audit append-only)
--   · ~60 stored procedures por módulo
--   · seeds: usuario system, scoring weights, 5 zonas Montería, 6 recursos
--
-- Próximo paso: pnpm --filter server db:seed para crear el admin con bcrypt.
-- =============================================================================
