-- 010_inventory.sql
-- Resource catalog, per-warehouse stock and the audit trail of manual
-- adjustments (RF-12, HU-14..HU-17, RN-03). Three tables that together back
-- the inventory module:
--
--   resource_types       — closed catalog (FOOD, BLANKET, MATTRESS, HYGIENE,
--                          MEDICATION). Soft-deleted via is_active=FALSE so
--                          historical donation/inventory rows keep referring
--                          to a valid row (HU-14 CA4).
--   inventory            — per (warehouse, resource_type, batch) row holding
--                          available_quantity and total_weight_kg.
--   inventory_adjustments — every manual adjustment (shrinkage, damage,
--                          return, correction) with its reason and note.

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
CREATE TYPE resource_category AS ENUM (
    'FOOD',
    'BLANKET',
    'MATTRESS',
    'HYGIENE',
    'MEDICATION'
);

-- adjustment_reason: PDF requires Spanish values (HU-17).
CREATE TYPE adjustment_reason AS ENUM (
    'MERMA',       -- shrinkage
    'DANO',        -- damaged in storage
    'DEVOLUCION',  -- returned to supplier / donor
    'CORRECCION'   -- count fix
);

-- ---------------------------------------------------------------------------
-- resource_types: closed catalog of donatable items.
-- ---------------------------------------------------------------------------
CREATE TABLE resource_types (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    category        resource_category NOT NULL,
    unit_of_measure TEXT NOT NULL,
    unit_weight_kg  DOUBLE PRECISION NOT NULL CHECK (unit_weight_kg >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_types_name_category_unique UNIQUE (name, category)
);

CREATE INDEX resource_types_category_idx  ON resource_types (category);
CREATE INDEX resource_types_is_active_idx ON resource_types (is_active);

CREATE TRIGGER resource_types_set_updated_at
    BEFORE UPDATE ON resource_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory: per-warehouse stock keyed by (warehouse, resource_type, batch).
-- batch is required so a single resource type can have several lots tracked
-- independently (different expiration dates).
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
    id                  SERIAL PRIMARY KEY,
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id)     ON DELETE RESTRICT,
    resource_type_id    INTEGER NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    available_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    total_weight_kg     DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
    batch               TEXT NOT NULL DEFAULT 'DEFAULT',
    expiration_date     DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT inventory_warehouse_resource_batch_unique
        UNIQUE (warehouse_id, resource_type_id, batch)
);

CREATE INDEX inventory_warehouse_id_idx     ON inventory (warehouse_id);
CREATE INDEX inventory_resource_type_id_idx ON inventory (resource_type_id);
CREATE INDEX inventory_expiration_date_idx  ON inventory (expiration_date) WHERE expiration_date IS NOT NULL;

CREATE TRIGGER inventory_set_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_adjustments: append-only history of manual adjustments. Driven
-- exclusively by sp_inventory_adjust — the controller never touches this
-- table directly, so every row reflects a transaction that also updated
-- inventory.available_quantity and warehouses.current_weight_kg.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_adjustments (
    id            SERIAL PRIMARY KEY,
    inventory_id  INTEGER NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    delta         INTEGER NOT NULL,
    reason        adjustment_reason NOT NULL,
    reason_note   TEXT NOT NULL CHECK (length(trim(reason_note)) > 0),
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inventory_adjustments_inventory_id_idx ON inventory_adjustments (inventory_id);
CREATE INDEX inventory_adjustments_user_id_idx      ON inventory_adjustments (user_id);
