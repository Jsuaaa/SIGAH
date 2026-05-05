-- 009_warehouses.sql
-- Physical warehouses that hold inbound donations and outbound deliveries
-- (RF-10, HU-11). Coordinates are mandatory (RN-10). The CHECK constraint
-- enforces RN-03 at the engine level — every SP that mutates
-- current_weight_kg additionally raises SH422 so the API returns 422 instead
-- of a generic 500.

CREATE TYPE warehouse_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE warehouses (
    id                 SERIAL PRIMARY KEY,
    name               TEXT NOT NULL UNIQUE,
    address            TEXT NOT NULL,
    zone_id            INTEGER NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    max_capacity_kg    DOUBLE PRECISION NOT NULL CHECK (max_capacity_kg > 0),
    current_weight_kg  DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (current_weight_kg >= 0),
    status             warehouse_status NOT NULL DEFAULT 'ACTIVE',
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT warehouses_weight_within_capacity
        CHECK (current_weight_kg <= max_capacity_kg)
);

CREATE INDEX warehouses_zone_id_idx ON warehouses (zone_id);
CREATE INDEX warehouses_status_idx  ON warehouses (status);
CREATE INDEX warehouses_name_trgm_idx ON warehouses USING gin (name gin_trgm_ops);

CREATE TRIGGER warehouses_set_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
