-- 015_auth_final.sql
-- Issue #9.1 — Adapta el módulo Auth a los requerimientos finales del PDF.
--
-- Cambios:
--   1. Migra el enum `role` de 4 valores (ADMIN, COORDINATOR, OPERATOR, VIEWER)
--      a los 6 valores finales definidos en el PDF.
--   2. Añade columnas nuevas a la tabla `users`:
--        name, is_active, failed_login_attempts, locked_until,
--        last_login_at, password_must_change.
--   3. Backfill: asigna name='Administrador SIGAH' al admin existente.
--
-- Estrategia para migrar el enum (PostgreSQL no permite ALTER TYPE ADD VALUE
-- dentro de una transacción cuando hay filas existentes con el tipo; además
-- queremos eliminar los valores viejos). Se usa RENAME + CREATE + UPDATE + DROP.

-- ============================================================
-- PASO 1: Renombrar el enum viejo para no colisionar
-- ============================================================
ALTER TYPE role RENAME TO role_old;

-- ============================================================
-- PASO 2: Crear el nuevo enum con los 6 valores del PDF
-- ============================================================
CREATE TYPE role AS ENUM (
    'ADMIN',
    'CENSADOR',
    'OPERADOR_ENTREGAS',
    'COORDINADOR_LOGISTICA',
    'FUNCIONARIO_CONTROL',
    'REGISTRADOR_DONACIONES'
);

-- ============================================================
-- PASO 3: Migrar la columna `users.role` al nuevo enum
-- ============================================================
-- Quitar el DEFAULT viejo: usa role_old::'VIEWER' y no se puede castear a TEXT.
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
-- Convertir a TEXT para reescribir los valores con el mapeo nuevo.
ALTER TABLE users ALTER COLUMN role TYPE TEXT;
-- Mapeo de valores viejos → nuevos.
UPDATE users SET role = 'ADMIN'                   WHERE role = 'ADMIN';
UPDATE users SET role = 'COORDINADOR_LOGISTICA'   WHERE role = 'COORDINATOR';
UPDATE users SET role = 'OPERADOR_ENTREGAS'       WHERE role = 'OPERATOR';
UPDATE users SET role = 'FUNCIONARIO_CONTROL'     WHERE role = 'VIEWER';
-- Aplicar el nuevo enum.
ALTER TABLE users ALTER COLUMN role TYPE role USING role::role;
-- Restaurar el DEFAULT con un valor válido del nuevo enum.
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'FUNCIONARIO_CONTROL';

-- ============================================================
-- PASO 4: Eliminar el enum viejo
-- ============================================================
DROP TYPE role_old;

-- ============================================================
-- PASO 5: Añadir columnas nuevas a `users`
-- ============================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name                   TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_active              BOOLEAN     NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS failed_login_attempts  INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_must_change   BOOLEAN     NOT NULL DEFAULT false;

-- ============================================================
-- PASO 6: Backfill — nombre del admin existente
-- ============================================================
UPDATE users
   SET name = 'Administrador SIGAH'
 WHERE email = 'admin@sigah.gov.co'
   AND name  = '';
