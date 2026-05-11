-- 001_admin_user.sql
-- Seed idempotente del usuario administrador inicial.
-- La contraseña se lee de la variable ADMIN_PASSWORD_HASH que el script de
-- seed Node.js (scripts/seed.ts) computa con bcrypt y la pasa como variable de
-- sustitución, o bien se actualiza manualmente tras el primer despliegue.
--
-- Si el admin ya existe, se actualiza name/is_active/role para reflejar los
-- valores finales de la migración #9.1 sin duplicar la fila.

INSERT INTO users (email, password_hash, role, name, is_active, password_must_change)
VALUES (
    'admin@sigah.gov.co',
    -- Placeholder: reemplazar con hash bcrypt real antes de correr en producción.
    -- El script pnpm db:seed calcula este valor dinámicamente.
    '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_BEFORE_USE',
    'ADMIN',
    'Administrador SIGAH',
    true,
    true   -- Debe cambiar la contraseña en el primer login
)
ON CONFLICT (email) DO UPDATE
    SET name                 = EXCLUDED.name,
        role                 = EXCLUDED.role,
        is_active            = EXCLUDED.is_active,
        password_must_change = EXCLUDED.password_must_change,
        updated_at           = now();
