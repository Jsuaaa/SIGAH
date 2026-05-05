-- 005_shelters.sql
-- Temporary shelters that host displaced families (RF-09, HU-10). Coordinates
-- are mandatory (RN-10) so the Map module (#26-#27) can geolocate every
-- shelter without nullable fallbacks.

CREATE TYPE shelter_type AS ENUM ('SCHOOL', 'CHURCH', 'COMMUNITY_CENTER', 'STADIUM', 'TENT', 'OTHER');

CREATE TABLE shelters (
    id                 SERIAL PRIMARY KEY,
    name               TEXT NOT NULL,
    address            TEXT NOT NULL,
    zone_id            INTEGER NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    max_capacity       INTEGER NOT NULL CHECK (max_capacity > 0),
    current_occupancy  INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
    type               shelter_type NOT NULL,
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shelters_occupancy_within_capacity CHECK (current_occupancy <= max_capacity),
    CONSTRAINT shelters_name_zone_unique UNIQUE (name, zone_id)
);

CREATE INDEX shelters_zone_id_idx ON shelters (zone_id);
CREATE INDEX shelters_name_trgm_idx ON shelters USING gin (name gin_trgm_ops);

CREATE TRIGGER shelters_set_updated_at
    BEFORE UPDATE ON shelters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
