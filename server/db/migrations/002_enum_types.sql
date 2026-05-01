-- 002_enum_types.sql
-- Enum types shared across the schema.
-- NOTE: Issue #9.1 (auth final) renames `role` to the 6 PDF values
-- (ADMIN, CENSADOR, OPERADOR_ENTREGAS, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL,
-- REGISTRADOR_DONACIONES) via a separate migration. We keep the v1 values here so
-- the existing zones test suite (which mints JWTs with COORDINATOR/OPERATOR/VIEWER)
-- keeps passing.

CREATE TYPE role AS ENUM ('ADMIN', 'COORDINATOR', 'OPERATOR', 'VIEWER');

CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
