-- 004_zones.sql
-- Geographic zones affected by the flood (RF-08, HU-09). Coordinates are
-- mandatory (RN-10).

CREATE TABLE zones (
    id                   SERIAL PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    risk_level           risk_level NOT NULL,
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    estimated_population INTEGER NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX zones_name_trgm_idx ON zones USING gin (name gin_trgm_ops);

CREATE TRIGGER zones_set_updated_at
    BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
