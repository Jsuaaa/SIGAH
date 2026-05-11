-- 013_donations.sql
-- Donations are the inbound side of the supply chain (RF-15..RF-17,
-- HU-19..HU-20). Each donation belongs to one donor and lands in one
-- warehouse. donation_type determines the side effects:
--   IN_KIND   : every detail row updates inventory and warehouses.current_weight_kg.
--   MONETARY  : monetary_amount required, details ignored, no inventory effect.
--   MIXED     : monetary_amount required AND inventory updated from details.
--
-- The atomicity guarantee (RN-03 + audit) lives in sp_donations_create — this
-- migration only sets up the schema.

CREATE TYPE donation_type AS ENUM ('IN_KIND', 'MONETARY', 'MIXED');

CREATE TABLE donations (
    id                       SERIAL PRIMARY KEY,
    donation_code            TEXT NOT NULL UNIQUE,
    donor_id                 INTEGER NOT NULL REFERENCES donors(id)     ON DELETE RESTRICT,
    destination_warehouse_id INTEGER          REFERENCES warehouses(id) ON DELETE RESTRICT,
    donation_type            donation_type NOT NULL,
    monetary_amount          NUMERIC(14, 2),
    date                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes                    TEXT,
    created_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A monetary or mixed donation must carry the amount; in-kind must not.
    CONSTRAINT donations_monetary_amount_consistency CHECK (
        (donation_type = 'IN_KIND'  AND monetary_amount IS NULL)
     OR (donation_type = 'MONETARY' AND monetary_amount IS NOT NULL AND monetary_amount > 0)
     OR (donation_type = 'MIXED'    AND monetary_amount IS NOT NULL AND monetary_amount > 0)
    ),

    -- IN_KIND/MIXED need a destination warehouse to apply inventory updates;
    -- pure MONETARY does not.
    CONSTRAINT donations_destination_consistency CHECK (
        (donation_type = 'MONETARY' AND destination_warehouse_id IS NULL)
     OR (donation_type IN ('IN_KIND', 'MIXED') AND destination_warehouse_id IS NOT NULL)
    )
);

CREATE INDEX donations_donor_id_idx                 ON donations (donor_id);
CREATE INDEX donations_destination_warehouse_id_idx ON donations (destination_warehouse_id);
CREATE INDEX donations_donation_type_idx            ON donations (donation_type);
CREATE INDEX donations_date_idx                     ON donations (date DESC);

CREATE TRIGGER donations_set_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE donation_details (
    id               SERIAL PRIMARY KEY,
    donation_id      INTEGER NOT NULL REFERENCES donations(id)      ON DELETE CASCADE,
    resource_type_id INTEGER NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg        DOUBLE PRECISION NOT NULL CHECK (weight_kg >= 0),
    batch            TEXT,
    expiration_date  DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX donation_details_donation_id_idx      ON donation_details (donation_id);
CREATE INDEX donation_details_resource_type_id_idx ON donation_details (resource_type_id);
