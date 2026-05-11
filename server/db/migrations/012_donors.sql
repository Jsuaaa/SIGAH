-- 012_donors.sql
-- Donors are the originating party of every donation (RF-15, HU-18). The
-- enum mirrors the PDF wording (Spanish). `contact` is required (HU-18 CA2)
-- and stored as a free-text string — phone or email — to keep the model
-- compatible with the variety of contacts the alcaldía records by hand.
--
-- (name, type) is unique so a "Cruz Roja" ORGANIZACION and a hypothetical
-- "Cruz Roja" EMPRESA stay distinct (HU-18 CA3). is_active enables
-- soft-delete: donors with at least one donation cannot be DELETEd; the SP
-- flips is_active to FALSE instead so historical references stay valid.

CREATE TYPE donor_type AS ENUM (
    'PERSONA_NATURAL',
    'EMPRESA',
    'ALCALDIA',
    'GOBERNACION',
    'ORGANIZACION'
);

CREATE TABLE donors (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    type        donor_type NOT NULL,
    contact     TEXT NOT NULL CHECK (length(trim(contact)) > 0),
    tax_id      TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT donors_name_type_unique UNIQUE (name, type)
);

CREATE INDEX donors_type_idx      ON donors (type);
CREATE INDEX donors_is_active_idx ON donors (is_active);
CREATE INDEX donors_name_trgm_idx ON donors USING gin (name gin_trgm_ops);

CREATE TRIGGER donors_set_updated_at
    BEFORE UPDATE ON donors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
