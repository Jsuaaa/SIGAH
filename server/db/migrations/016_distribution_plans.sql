-- 016_distribution_plans.sql
-- Planes de distribución priorizados (RF-18, HU-21, Issue #46).
-- Define las tablas distribution_plans y distribution_plan_items, y añade
-- el FK que deliveries.plan_item_id ya tenía pendiente (#46 migration note).

-- ---- Enums ----------------------------------------------------------------

CREATE TYPE distribution_plan_status AS ENUM (
    'PROGRAMADA',
    'EN_EJECUCION',
    'COMPLETADA',
    'CANCELADA'
);

CREATE TYPE distribution_plan_scope AS ENUM (
    'GLOBAL',
    'ZONA',
    'REFUGIO',
    'LOTE'
);

CREATE TYPE distribution_plan_item_status AS ENUM (
    'PENDIENTE',
    'ENTREGADO',
    'SIN_ATENDER'
);

-- ---- distribution_plans ---------------------------------------------------

CREATE TABLE distribution_plans (
    id          SERIAL PRIMARY KEY,
    plan_code   TEXT NOT NULL UNIQUE,
    created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status      distribution_plan_status NOT NULL DEFAULT 'PROGRAMADA',
    scope       distribution_plan_scope  NOT NULL,
    scope_id    INTEGER,                 -- zone_id | shelter_id | NULL (GLOBAL/LOTE)
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX distribution_plans_status_idx     ON distribution_plans (status);
CREATE INDEX distribution_plans_created_by_idx ON distribution_plans (created_by);
CREATE INDEX distribution_plans_scope_idx      ON distribution_plans (scope, scope_id);

CREATE TRIGGER distribution_plans_set_updated_at
    BEFORE UPDATE ON distribution_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- distribution_plan_items ----------------------------------------------

CREATE TABLE distribution_plan_items (
    id                       SERIAL PRIMARY KEY,
    plan_id                  INTEGER NOT NULL REFERENCES distribution_plans(id) ON DELETE CASCADE,
    family_id                INTEGER NOT NULL REFERENCES families(id)           ON DELETE RESTRICT,
    source_warehouse_id      INTEGER          REFERENCES warehouses(id)         ON DELETE RESTRICT,
    target_coverage_days     INTEGER NOT NULL CHECK (target_coverage_days >= 3),
    priority_score_snapshot  DOUBLE PRECISION NOT NULL,
    status                   distribution_plan_item_status NOT NULL DEFAULT 'PENDIENTE',
    delivery_id              INTEGER          REFERENCES deliveries(id)         ON DELETE SET NULL,
    reason                   TEXT,            -- motivo de SIN_ATENDER si aplica
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX distribution_plan_items_plan_id_idx    ON distribution_plan_items (plan_id);
CREATE INDEX distribution_plan_items_status_idx     ON distribution_plan_items (plan_id, status);
CREATE INDEX distribution_plan_items_family_id_idx  ON distribution_plan_items (family_id);

CREATE TRIGGER distribution_plan_items_set_updated_at
    BEFORE UPDATE ON distribution_plan_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- FK pendiente en deliveries (#46) ------------------------------------
-- La columna plan_item_id ya existe (014_deliveries.sql) pero sin FK porque
-- distribution_plan_items no existía aún. Se añade ahora de forma idempotente.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
         WHERE constraint_name = 'deliveries_plan_item_id_fkey'
           AND table_name      = 'deliveries'
    ) THEN
        ALTER TABLE deliveries
            ADD CONSTRAINT deliveries_plan_item_id_fkey
            FOREIGN KEY (plan_item_id)
            REFERENCES distribution_plan_items(id)
            ON DELETE SET NULL;
    END IF;
END $$;
