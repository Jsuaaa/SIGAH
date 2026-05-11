-- 014_deliveries.sql
-- Outbound side of the supply chain (RF-19..RF-22, HU-22..HU-23). One
-- delivery row per family receipt; details enumerate which resources were
-- handed over. The full transactional logic (eligibility, stock decrement,
-- priority recompute, idempotency) lives in sp_delivery_create (#23/#24).
-- This migration only defines the schema.

CREATE TYPE delivery_status AS ENUM ('PROGRAMADA', 'EN_CURSO', 'ENTREGADA');

CREATE TABLE deliveries (
    id                       SERIAL PRIMARY KEY,
    delivery_code            TEXT NOT NULL UNIQUE,
    family_id                INTEGER NOT NULL REFERENCES families(id)   ON DELETE RESTRICT,
    source_warehouse_id      INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    -- distribution_plan_items lands in #21+; we keep the FK column nullable
    -- and add the constraint when the table exists (#46).
    plan_item_id             INTEGER,
    delivery_date            TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    received_by_document     TEXT,
    -- RN-01: each delivery covers at least 3 days.
    coverage_days            INTEGER NOT NULL CHECK (coverage_days >= 3),
    status                   delivery_status NOT NULL DEFAULT 'PROGRAMADA',
    delivery_latitude        DOUBLE PRECISION,
    delivery_longitude       DOUBLE PRECISION,
    -- RN-02 escape hatch: COORDINADOR_LOGISTICA can authorize a delivery
    -- before the previous coverage expires. Both fields must be present
    -- together — the SP enforces this at the call site (#23).
    exception_reason         TEXT,
    exception_authorized_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Idempotency-Key for offline sync (#48). NULL while online creates run
    -- through the regular flow; offline replays carry the original op id so
    -- the SP can short-circuit on duplicates.
    client_op_id             TEXT UNIQUE,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT deliveries_exception_pair_consistency CHECK (
        (exception_reason IS NULL AND exception_authorized_by IS NULL)
     OR (exception_reason IS NOT NULL AND exception_authorized_by IS NOT NULL)
    )
);

CREATE INDEX deliveries_family_id_idx           ON deliveries (family_id);
CREATE INDEX deliveries_source_warehouse_id_idx ON deliveries (source_warehouse_id);
CREATE INDEX deliveries_status_idx              ON deliveries (status);
CREATE INDEX deliveries_delivery_date_idx       ON deliveries (delivery_date DESC);
-- Eligibility lookup hot path (#23): "is family X covered today?"
CREATE INDEX deliveries_family_status_date_idx  ON deliveries (family_id, status, delivery_date DESC);

CREATE TRIGGER deliveries_set_updated_at
    BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE delivery_details (
    id               SERIAL PRIMARY KEY,
    delivery_id      INTEGER NOT NULL REFERENCES deliveries(id)      ON DELETE CASCADE,
    resource_type_id INTEGER NOT NULL REFERENCES resource_types(id)  ON DELETE RESTRICT,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg        DOUBLE PRECISION NOT NULL CHECK (weight_kg >= 0),
    batch            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX delivery_details_delivery_id_idx      ON delivery_details (delivery_id);
CREATE INDEX delivery_details_resource_type_id_idx ON delivery_details (resource_type_id);
