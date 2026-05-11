-- 017_relocations.sql
-- Registro de traslados de familias entre refugios (RF-15, HU-24, Issue #27).
-- La lógica transaccional (verificación de capacidad, actualización de ocupación,
-- actualización de familia) vive en sp_relocation_apply.

-- ---- Enum ------------------------------------------------------------------

CREATE TYPE relocation_type AS ENUM ('TEMPORARY', 'PERMANENT');

-- ---- Table -----------------------------------------------------------------

CREATE TABLE relocations (
    id                      SERIAL PRIMARY KEY,
    family_id               INTEGER NOT NULL  REFERENCES families(id)  ON DELETE RESTRICT,
    -- NULL cuando la familia no estaba asignada a un refugio antes del traslado.
    origin_shelter_id       INTEGER           REFERENCES shelters(id)  ON DELETE SET NULL,
    destination_shelter_id  INTEGER NOT NULL  REFERENCES shelters(id)  ON DELETE RESTRICT,
    type                    relocation_type   NOT NULL,
    relocation_date         TIMESTAMPTZ       NOT NULL DEFAULT now(),
    reason                  TEXT              NOT NULL,
    authorized_by           INTEGER NOT NULL  REFERENCES users(id)     ON DELETE RESTRICT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- ---- Trigger updated_at ----------------------------------------------------

CREATE OR REPLACE FUNCTION trg_relocations_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER relocations_set_updated_at
    BEFORE UPDATE ON relocations
    FOR EACH ROW EXECUTE FUNCTION trg_relocations_set_updated_at();

-- ---- Indexes ---------------------------------------------------------------

CREATE INDEX idx_relocations_family_id        ON relocations(family_id);
CREATE INDEX idx_relocations_destination      ON relocations(destination_shelter_id);
CREATE INDEX idx_relocations_relocation_date  ON relocations(relocation_date DESC);
