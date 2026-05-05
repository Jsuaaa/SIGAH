-- 006_families.sql
-- Census of families affected by the flood (RF-02..RF-05, HU-04..HU-07).
-- Adds:
--   - shared `code_counters` table backing fn_next_code (RN-07).
--   - `family_status` enum (Spanish PDF values).
--   - `families` table with aggregate counts cached for the priority formula
--     (RN-04/RN-08) and pg_trgm indexes for the <2s unified search (RNF-04).
--   - `privacy_consents` table (Ley 1581/2012, RN-09).

-- ---------------------------------------------------------------------------
-- code_counters: backing table for fn_next_code('FAM'|'DON'|'ENT'|'PLN'|...).
-- One row per (prefix, year). fn_next_code uses SELECT … FOR UPDATE to
-- serialize concurrent inserts and guarantee strictly monotonic NNNNN.
-- ---------------------------------------------------------------------------
CREATE TABLE code_counters (
    prefix     TEXT    NOT NULL,
    year       INTEGER NOT NULL,
    last_value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (prefix, year)
);

-- ---------------------------------------------------------------------------
-- family_status: PDF requires Spanish enum values (HU-04 CA3).
-- ---------------------------------------------------------------------------
CREATE TYPE family_status AS ENUM ('ACTIVO', 'EN_REFUGIO', 'EVACUADO');

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
CREATE TABLE families (
    id                       SERIAL PRIMARY KEY,
    family_code              TEXT NOT NULL UNIQUE,
    head_document            TEXT NOT NULL,
    zone_id                  INTEGER NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    shelter_id               INTEGER REFERENCES shelters(id) ON DELETE SET NULL,
    num_members              INTEGER NOT NULL CHECK (num_members > 0),
    num_children_under_5     INTEGER NOT NULL DEFAULT 0 CHECK (num_children_under_5 >= 0),
    num_adults_over_65       INTEGER NOT NULL DEFAULT 0 CHECK (num_adults_over_65 >= 0),
    num_pregnant             INTEGER NOT NULL DEFAULT 0 CHECK (num_pregnant >= 0),
    num_disabled             INTEGER NOT NULL DEFAULT 0 CHECK (num_disabled >= 0),
    priority_score           DOUBLE PRECISION NOT NULL DEFAULT 0,
    priority_score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                   family_status NOT NULL DEFAULT 'ACTIVO',
    latitude                 DOUBLE PRECISION,
    longitude                DOUBLE PRECISION,
    reference_address        TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aggregates must never exceed total members.
ALTER TABLE families
    ADD CONSTRAINT families_aggregates_within_members
        CHECK (num_children_under_5 + num_adults_over_65 + num_pregnant + num_disabled <= num_members * 2);
-- The * 2 accounts for overlapping conditions (e.g. a pregnant disabled woman
-- counts in two aggregates). It is a soft sanity bound, not exact.

CREATE INDEX families_zone_id_idx              ON families (zone_id);
CREATE INDEX families_shelter_id_idx           ON families (shelter_id);
CREATE INDEX families_status_idx               ON families (status);
CREATE INDEX families_priority_score_idx       ON families (priority_score DESC);

-- pg_trgm indexes power the <2s unified search (RNF-04, HU-06).
CREATE INDEX families_family_code_trgm_idx     ON families USING gin (family_code       gin_trgm_ops);
CREATE INDEX families_head_document_trgm_idx   ON families USING gin (head_document     gin_trgm_ops);
CREATE INDEX families_reference_address_trgm_idx
    ON families USING gin (reference_address gin_trgm_ops)
    WHERE reference_address IS NOT NULL;

CREATE TRIGGER families_set_updated_at
    BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- privacy_consents: one row per consent acceptance (Ley 1581/2012, RN-09).
-- A family can re-accept (e.g. after data update). Latest acceptance wins.
-- ---------------------------------------------------------------------------
CREATE TABLE privacy_consents (
    id                    SERIAL PRIMARY KEY,
    family_id             INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    accepted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_by_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    law_version           TEXT NOT NULL DEFAULT 'Ley 1581/2012',
    ip_address            INET
);

CREATE INDEX privacy_consents_family_id_idx ON privacy_consents (family_id);
