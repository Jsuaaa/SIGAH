-- 017_health_vectors.sql
-- Vectores de riesgo sanitario (RF-26, HU-25).
-- Registra amenazas de salud pública (agua contaminada, insectos, roedores, etc.)
-- asociadas a zonas o refugios, con seguimiento de estado y acciones tomadas.

CREATE TYPE vector_type AS ENUM (
    'AGUA_CONTAMINADA',
    'INSECTOS',
    'ROEDORES',
    'OTRO'
);

CREATE TYPE health_vector_status AS ENUM (
    'ACTIVO',
    'EN_ATENCION',
    'RESUELTO'
);

CREATE TABLE health_vectors (
    id              SERIAL PRIMARY KEY,
    vector_type     vector_type         NOT NULL,
    risk_level      risk_level          NOT NULL,
    status          health_vector_status NOT NULL DEFAULT 'ACTIVO',
    description     TEXT,
    actions_taken   TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    zone_id         INTEGER REFERENCES zones(id)    ON DELETE RESTRICT,
    shelter_id      INTEGER REFERENCES shelters(id) ON DELETE RESTRICT,
    reported_date   TIMESTAMPTZ         NOT NULL DEFAULT now(),
    reported_by     INTEGER             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    resolved_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Al menos una referencia geográfica: zone/shelter o coordenadas
    CONSTRAINT hv_location_required CHECK (
        zone_id IS NOT NULL
        OR shelter_id IS NOT NULL
        OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

CREATE INDEX hv_zone_id_idx       ON health_vectors (zone_id);
CREATE INDEX hv_shelter_id_idx    ON health_vectors (shelter_id);
CREATE INDEX hv_status_idx        ON health_vectors (status);
CREATE INDEX hv_risk_level_idx    ON health_vectors (risk_level);
CREATE INDEX hv_vector_type_idx   ON health_vectors (vector_type);
CREATE INDEX hv_reported_date_idx ON health_vectors (reported_date DESC);

CREATE TRIGGER health_vectors_set_updated_at
    BEFORE UPDATE ON health_vectors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
