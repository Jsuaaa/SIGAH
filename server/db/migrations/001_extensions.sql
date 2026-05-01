-- 001_extensions.sql
-- PostgreSQL extensions used across the project.
--   pgcrypto : gen_random_uuid(), digest helpers (used by future modules).
--   pg_trgm  : trigram indexes for the <2s search requirement (RNF-04, HU-06).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
