-- 007_persons.sql
-- Individual members that make up a family (RF-04, HU-05). Each mutation on
-- this table must keep families.num_* aggregates in sync — that orchestration
-- lives in the persons SPs (#13). Issue #14 will hook the priority recalc.

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
-- relationship: PDF requires Spanish values (HU-05 CA2).
CREATE TYPE relationship AS ENUM ('ESPOSO_A', 'HIJO_A', 'PADRE_MADRE', 'HERMANO_A', 'OTRO');

-- gender: kept simple (M/F/OTRO). Stored as enum so the API surface stays
-- closed and indexes remain compact.
CREATE TYPE gender AS ENUM ('M', 'F', 'OTRO');

-- ---------------------------------------------------------------------------
-- persons
-- ---------------------------------------------------------------------------
CREATE TABLE persons (
    id                   SERIAL PRIMARY KEY,
    family_id            INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    document             TEXT NOT NULL UNIQUE,
    birth_date           DATE NOT NULL,
    gender               gender NOT NULL,
    relationship         relationship NOT NULL,
    -- special_conditions is an open TEXT[] but its values are constrained to a
    -- closed set. We use a CHECK rather than a multi-column boolean schema so
    -- the API can evolve (e.g. add CHRONIC_DISEASE) without a migration.
    special_conditions   TEXT[] NOT NULL DEFAULT '{}',
    requires_medication  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT persons_special_conditions_valid CHECK (
        special_conditions <@ ARRAY['CHILD_UNDER_5', 'ELDERLY_OVER_65', 'PREGNANT', 'DISABLED']::TEXT[]
    ),
    CONSTRAINT persons_birth_date_not_future CHECK (birth_date <= CURRENT_DATE)
);

CREATE INDEX persons_family_id_idx       ON persons (family_id);
CREATE INDEX persons_document_trgm_idx   ON persons USING gin (document gin_trgm_ops);

CREATE TRIGGER persons_set_updated_at
    BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
