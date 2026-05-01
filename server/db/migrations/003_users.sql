-- 003_users.sql
-- App users. Mirrors the Prisma User model that this migration replaces.
-- Issue #9.1 will add: name, is_active, failed_login_attempts, locked_until,
-- last_login_at, password_must_change. We stop at the v1 shape on purpose so
-- the existing test suite passes.

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          role NOT NULL DEFAULT 'VIEWER',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX users_email_idx ON users (email);

-- Generic trigger to keep updated_at in sync. Reused by every table.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
