-- 011_alert_thresholds.sql
-- Per-resource minimum quantity that triggers a low-stock alert (HU-16 CA2,
-- RF-13). One row per resource_type (UNIQUE). When a resource has no
-- threshold row, fn_inventory_alerts falls back to a global default (10
-- units). Adjustments are auditable via updated_by + updated_at.

CREATE TABLE alert_thresholds (
    id                SERIAL PRIMARY KEY,
    resource_type_id  INTEGER NOT NULL UNIQUE
                      REFERENCES resource_types(id) ON DELETE CASCADE,
    min_quantity      INTEGER NOT NULL CHECK (min_quantity >= 0),
    updated_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alert_thresholds_resource_type_id_idx ON alert_thresholds (resource_type_id);
