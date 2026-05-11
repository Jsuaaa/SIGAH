-- =============================================================================
-- 006_demo_data.sql
-- Datos de demostración para SIGAH — Entorno de presentación reproducible.
-- Construye sobre los seeds 001–005 (admin, zones, shelters, warehouses,
-- resource_types). Idempotente mediante ON CONFLICT DO NOTHING.
--
-- Contraseña demo: "Demo1234!" — hash bcrypt generado con factor 10.
-- REEMPLAZAR con hash real antes de despliegue en producción.
-- Hash placeholder: $2b$10$demoPlaceholderHashForDemo1234!Replace
-- Para generar el real: node -e "const bcrypt=require('bcrypt'); bcrypt.hash('Demo1234!',10).then(h=>console.log(h))"
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1 — Usuarios demo (uno por rol no-ADMIN)
-- =============================================================================

INSERT INTO users (email, password_hash, role, name, is_active, password_must_change)
VALUES
  -- CENSADOR — registra familias y personas en campo
  (
    'censador.demo@sigah.gov.co',
    '$2b$10$demoPlaceholderHashForDemo1234!Replace',
    'CENSADOR',
    'Carlos Martínez Censador',
    true,
    true
  ),
  -- OPERADOR_ENTREGAS — ejecuta entregas en el campo
  (
    'operador.demo@sigah.gov.co',
    '$2b$10$demoPlaceholderHashForDemo1234!Replace',
    'OPERADOR_ENTREGAS',
    'Ana Rodríguez Operadora',
    true,
    true
  ),
  -- COORDINADOR_LOGISTICA — planifica y aprueba excepciones
  (
    'coordinador.demo@sigah.gov.co',
    '$2b$10$demoPlaceholderHashForDemo1234!Replace',
    'COORDINADOR_LOGISTICA',
    'Luis Hernández Coordinador',
    true,
    true
  ),
  -- FUNCIONARIO_CONTROL — audita y visualiza reportes
  (
    'control.demo@sigah.gov.co',
    '$2b$10$demoPlaceholderHashForDemo1234!Replace',
    'FUNCIONARIO_CONTROL',
    'María Torres Controladora',
    true,
    true
  ),
  -- REGISTRADOR_DONACIONES — registra donantes y donaciones
  (
    'donaciones.demo@sigah.gov.co',
    '$2b$10$demoPlaceholderHashForDemo1234!Replace',
    'REGISTRADOR_DONACIONES',
    'Pedro Salcedo Registrador',
    true,
    true
  )
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- SECCIÓN 2 — Familias demo (30 familias en distintas zonas de Montería)
-- Datos sintéticos. head_document único por cédula simulada.
-- Depende de: zones (seed 002).
-- =============================================================================

INSERT INTO families (
  family_code, head_document, zone_id, num_members,
  num_children_under_5, num_adults_over_65, num_pregnant, num_disabled,
  priority_score, priority_score_breakdown, status,
  latitude, longitude, reference_address
)
SELECT
  v.family_code, v.head_document, z.id, v.num_members,
  v.num_children_under_5, v.num_adults_over_65, v.num_pregnant, v.num_disabled,
  v.priority_score, v.breakdown::jsonb, v.status::family_status,
  v.lat, v.lng, v.ref_address
FROM (VALUES
  -- Zona Cantaclaro (CRITICAL)
  ('FAM-2026-90001','1001001001', 'Cantaclaro',              5, 2, 0, 1, 0, 48.5, '{"base":48.5}', 'ACTIVO',     8.7322, -75.8968, 'Calle 41 #14-10, Cantaclaro'),
  ('FAM-2026-90002','1001001002', 'Cantaclaro',              3, 0, 1, 0, 0, 31.0, '{"base":31.0}', 'EN_REFUGIO', 8.7325, -75.8970, 'Carrera 15 #40-22, Cantaclaro'),
  ('FAM-2026-90003','1001001003', 'Cantaclaro',              7, 3, 1, 0, 1, 65.0, '{"base":65.0}', 'ACTIVO',     8.7318, -75.8965, 'Manzana 4 Casa 12, Cantaclaro'),
  ('FAM-2026-90004','1001001004', 'Cantaclaro',              4, 1, 0, 0, 0, 35.5, '{"base":35.5}', 'ACTIVO',     8.7320, -75.8962, 'Diagonal 40 #13-05, Cantaclaro'),
  ('FAM-2026-90005','1001001005', 'Cantaclaro',              6, 2, 0, 1, 1, 58.0, '{"base":58.0}', 'EN_REFUGIO', 8.7327, -75.8972, 'Sector Las Margaritas, Cantaclaro'),
  ('FAM-2026-90006','1001001006', 'Cantaclaro',              2, 0, 0, 0, 0, 18.0, '{"base":18.0}', 'ACTIVO',     8.7315, -75.8960, 'Bloque 3 Apto 201, Cantaclaro'),
  -- Zona Robinson Pitalúa (HIGH)
  ('FAM-2026-90007','1002001001', 'Robinson Pitalúa',        4, 1, 0, 0, 1, 40.0, '{"base":40.0}', 'ACTIVO',     8.7416, -75.9012, 'Calle 22 #18-15, Robinson'),
  ('FAM-2026-90008','1002001002', 'Robinson Pitalúa',        5, 2, 1, 0, 0, 50.0, '{"base":50.0}', 'ACTIVO',     8.7419, -75.9015, 'Carrera 19 #23-08, Robinson'),
  ('FAM-2026-90009','1002001003', 'Robinson Pitalúa',        3, 0, 0, 1, 0, 33.0, '{"base":33.0}', 'EN_REFUGIO', 8.7413, -75.9010, 'Callejón Los Almendros, Robinson'),
  ('FAM-2026-90010','1002001004', 'Robinson Pitalúa',        6, 2, 0, 0, 2, 55.0, '{"base":55.0}', 'ACTIVO',     8.7421, -75.9018, 'Manzana 7 Lote 3, Robinson'),
  ('FAM-2026-90011','1002001005', 'Robinson Pitalúa',        2, 0, 1, 0, 0, 28.0, '{"base":28.0}', 'ACTIVO',     8.7410, -75.9008, 'Vereda El Paso #5, Robinson'),
  ('FAM-2026-90012','1002001006', 'Robinson Pitalúa',        4, 1, 1, 0, 0, 42.0, '{"base":42.0}', 'ACTIVO',     8.7423, -75.9020, 'Cra. 20 #24-01, Robinson Pitalúa'),
  -- Zona El Poblado (HIGH)
  ('FAM-2026-90013','1003001001', 'El Poblado',              5, 1, 0, 1, 0, 46.0, '{"base":46.0}', 'ACTIVO',     8.7590, -75.9135, 'Manzana 11 Casa 5, El Poblado'),
  ('FAM-2026-90014','1003001002', 'El Poblado',              3, 0, 0, 0, 1, 32.0, '{"base":32.0}', 'EN_REFUGIO', 8.7592, -75.9137, 'Carrera 14 #31-10, El Poblado'),
  ('FAM-2026-90015','1003001003', 'El Poblado',              7, 3, 0, 0, 0, 52.0, '{"base":52.0}', 'ACTIVO',     8.7588, -75.9132, 'Diagonal 30 #12-15, El Poblado'),
  ('FAM-2026-90016','1003001004', 'El Poblado',              4, 0, 2, 0, 0, 44.0, '{"base":44.0}', 'ACTIVO',     8.7594, -75.9140, 'Sector Nueva Esperanza #8, El Poblado'),
  ('FAM-2026-90017','1003001005', 'El Poblado',              2, 0, 0, 1, 0, 24.0, '{"base":24.0}', 'ACTIVO',     8.7587, -75.9130, 'Calle 30 #15-22, El Poblado'),
  ('FAM-2026-90018','1003001006', 'El Poblado',              6, 2, 1, 0, 1, 60.0, '{"base":60.0}', 'ACTIVO',     8.7596, -75.9142, 'Manzana 12 Lote 9, El Poblado'),
  -- Zona Mogambo (MEDIUM)
  ('FAM-2026-90019','1004001001', 'Mogambo',                 3, 1, 0, 0, 0, 22.0, '{"base":22.0}', 'ACTIVO',     8.7205, -75.8846, 'Sector Norte #3, Mogambo'),
  ('FAM-2026-90020','1004001002', 'Mogambo',                 5, 0, 1, 1, 0, 42.0, '{"base":42.0}', 'EN_REFUGIO', 8.7207, -75.8848, 'Carrera 12 #18-04, Mogambo'),
  ('FAM-2026-90021','1004001003', 'Mogambo',                 4, 2, 0, 0, 0, 30.0, '{"base":30.0}', 'ACTIVO',     8.7202, -75.8843, 'Calle 17 #11-09, Mogambo'),
  ('FAM-2026-90022','1004001004', 'Mogambo',                 2, 0, 0, 0, 1, 20.0, '{"base":20.0}', 'ACTIVO',     8.7210, -75.8850, 'Manzana 2 Casa 8, Mogambo'),
  ('FAM-2026-90023','1004001005', 'Mogambo',                 6, 1, 2, 0, 0, 48.0, '{"base":48.0}', 'ACTIVO',     8.7200, -75.8840, 'Sector Sur Casa 15, Mogambo'),
  ('FAM-2026-90024','1004001006', 'Mogambo',                 3, 0, 0, 1, 0, 26.0, '{"base":26.0}', 'ACTIVO',     8.7212, -75.8852, 'Diagonal 18 #10-03, Mogambo'),
  -- Zona Margen Izquierda Centro (CRITICAL)
  ('FAM-2026-90025','1005001001', 'Margen Izquierda Centro', 8, 3, 1, 1, 1, 80.0, '{"base":80.0}', 'EN_REFUGIO', 8.7498, -75.9052, 'Av. Circunvalar #24-08, Margen'),
  ('FAM-2026-90026','1005001002', 'Margen Izquierda Centro', 4, 0, 0, 0, 2, 45.0, '{"base":45.0}', 'ACTIVO',     8.7500, -75.9055, 'Callejón Sinú #3, Margen'),
  ('FAM-2026-90027','1005001003', 'Margen Izquierda Centro', 5, 2, 0, 0, 0, 47.0, '{"base":47.0}', 'ACTIVO',     8.7495, -75.9048, 'Sector Inundado Casa 21, Margen'),
  ('FAM-2026-90028','1005001004', 'Margen Izquierda Centro', 3, 1, 0, 1, 0, 38.0, '{"base":38.0}', 'EN_REFUGIO', 8.7503, -75.9060, 'Calle del Río #6, Margen'),
  ('FAM-2026-90029','1005001005', 'Margen Izquierda Centro', 6, 0, 2, 0, 1, 58.0, '{"base":58.0}', 'ACTIVO',     8.7492, -75.9045, 'Manzana 9 Lote 4, Margen'),
  ('FAM-2026-90030','1005001006', 'Margen Izquierda Centro', 2, 0, 0, 0, 0, 16.0, '{"base":16.0}', 'ACTIVO',     8.7505, -75.9062, 'Sector Alto Sinú #1, Margen')
) AS v(family_code, head_document, zone_name, num_members,
       num_children_under_5, num_adults_over_65, num_pregnant, num_disabled,
       priority_score, breakdown, status, lat, lng, ref_address)
JOIN zones z ON z.name = v.zone_name
ON CONFLICT (family_code) DO NOTHING;

-- Privacy consents para las familias demo (vincula al admin)
INSERT INTO privacy_consents (family_id, accepted_by_user_id, law_version, ip_address)
SELECT f.id, u.id, '1.0', '127.0.0.1'
FROM families f
CROSS JOIN users u
WHERE f.family_code LIKE 'FAM-2026-9%'
  AND u.email = 'admin@sigah.gov.co'
  AND NOT EXISTS (
    SELECT 1 FROM privacy_consents pc WHERE pc.family_id = f.id
  );

-- =============================================================================
-- SECCIÓN 3 — Donantes demo (uno por DonorType)
-- =============================================================================

INSERT INTO donors (name, type, contact, tax_id, is_active)
VALUES
  ('Juan Pérez Montoya',          'PERSONA_NATURAL', 'juanperez@gmail.com',          NULL,           true),
  ('Constructora Montería S.A.',  'EMPRESA',         'donaciones@constructora.co',   '900123456-1',  true),
  ('Alcaldía de Montería',        'ALCALDIA',        'secretaria@alcaldia.gov.co',   '800987654-2',  true),
  ('Gobernación de Córdoba',      'GOBERNACION',     'secretaria@gobcordoba.gov.co', '800123789-3',  true),
  ('Cruz Roja Montería',          'ORGANIZACION',    'monteria@cruzroja.org.co',     NULL,           true)
ON CONFLICT (name, type) DO NOTHING;

-- =============================================================================
-- SECCIÓN 4 — Donaciones demo (8 donaciones, mix IN_KIND/MONETARY)
-- Depende de: donors (sección 3), warehouses (seed 004),
--             resource_types (seed 005), users (sección 1).
-- =============================================================================

-- Donaciones IN_KIND y MIXED → ingresan inventario físico (requieren warehouse)
INSERT INTO donations (
  donation_code, donor_id, destination_warehouse_id, donation_type,
  monetary_amount, date, notes, created_by
)
SELECT
  v.code,
  d.id,
  w.id,
  v.dtype::donation_type,
  v.amount::numeric,
  v.ddate::date,
  v.notes,
  u.id
FROM (VALUES
  ('DON-2026-90001', 'Juan Pérez Montoya',         'PERSONA_NATURAL', 'Bodega Cantaclaro',               'IN_KIND', NULL,      '2026-03-01', 'Donación inicial arroz y frijol'),
  ('DON-2026-90002', 'Constructora Montería S.A.', 'EMPRESA',         'Bodega Central Margen Izquierda', 'IN_KIND', NULL,      '2026-03-05', 'Cobijas y colchonetas post-inundación'),
  ('DON-2026-90004', 'Gobernación de Córdoba',     'GOBERNACION',     'Bodega Central Margen Izquierda', 'IN_KIND', NULL,      '2026-03-10', 'Medicamentos y botiquines'),
  ('DON-2026-90005', 'Cruz Roja Montería',         'ORGANIZACION',    'Bodega El Poblado',               'IN_KIND', NULL,      '2026-03-12', 'Agua potable y alimentos no perecederos'),
  ('DON-2026-90007', 'Constructora Montería S.A.', 'EMPRESA',         'Bodega El Poblado',               'IN_KIND', NULL,      '2026-03-18', 'Segunda entrega arroz blanco y pasta'),
  ('DON-2026-90008', 'Cruz Roja Montería',         'ORGANIZACION',    'Bodega Robinson Pitalúa',         'MIXED',   '2000000', '2026-03-20', 'Donación mixta: materiales + transferencia')
) AS v(code, donor_name, donor_type, warehouse_name, dtype, amount, ddate, notes)
JOIN donors d ON d.name = v.donor_name AND d.type = v.donor_type::donor_type
JOIN warehouses w ON w.name = v.warehouse_name
JOIN users u ON u.email = 'admin@sigah.gov.co'
ON CONFLICT (donation_code) DO NOTHING;

-- Donaciones MONETARY puras → sin warehouse (constraint de BD)
INSERT INTO donations (
  donation_code, donor_id, destination_warehouse_id, donation_type,
  monetary_amount, date, notes, created_by
)
SELECT
  v.code,
  d.id,
  NULL,
  'MONETARY'::donation_type,
  v.amount::numeric,
  v.ddate::date,
  v.notes,
  u.id
FROM (VALUES
  ('DON-2026-90003', 'Alcaldía de Montería',  'ALCALDIA',        '5000000', '2026-03-08', 'Transferencia municipal fondo ayuda humanitaria'),
  ('DON-2026-90006', 'Juan Pérez Montoya',    'PERSONA_NATURAL', '800000',  '2026-03-15', 'Contribución personal para insumos de higiene')
) AS v(code, donor_name, donor_type, amount, ddate, notes)
JOIN donors d ON d.name = v.donor_name AND d.type = v.donor_type::donor_type
JOIN users u ON u.email = 'admin@sigah.gov.co'
ON CONFLICT (donation_code) DO NOTHING;

-- Detalles de las donaciones IN_KIND (ajustar IDs via subquery seguro)
INSERT INTO donation_details (
  donation_id, resource_type_id, quantity, weight_kg, batch, expiration_date
)
SELECT
  dn.id, rt.id, v.qty, v.wkg, v.batch, v.expdate::date
FROM (VALUES
  -- DON-2026-90001: arroz y frijol para Cantaclaro
  ('DON-2026-90001', 'Arroz blanco',        200, 200.0, 'LOTE-MAR-001', '2027-03-01'),
  ('DON-2026-90001', 'Frijol rojo',         100, 100.0, 'LOTE-MAR-001', '2027-03-01'),
  -- DON-2026-90002: cobijas y colchonetas
  ('DON-2026-90002', 'Cobija doble',        150, 270.0, 'LOTE-MAR-002', NULL),
  ('DON-2026-90002', 'Colchoneta sencilla',  80, 280.0, 'LOTE-MAR-002', NULL),
  -- DON-2026-90004: medicamentos
  ('DON-2026-90004', 'Botiquín básico',      60,  60.0, 'LOTE-MAR-004', '2028-01-01'),
  ('DON-2026-90004', 'Suero oral',          500,  25.0, 'LOTE-MAR-004', '2027-06-01'),
  -- DON-2026-90005: agua y alimentos
  ('DON-2026-90005', 'Agua potable',        400, 600.0, 'LOTE-MAR-005', '2026-09-01'),
  ('DON-2026-90005', 'Atún enlatado',       200,  36.0, 'LOTE-MAR-005', '2027-09-01'),
  -- DON-2026-90007: arroz y pasta
  ('DON-2026-90007', 'Arroz blanco',        150, 150.0, 'LOTE-MAR-007', '2027-03-01'),
  ('DON-2026-90007', 'Pasta',               100,  50.0, 'LOTE-MAR-007', '2027-06-01'),
  -- DON-2026-90008: jabón e higiene
  ('DON-2026-90008', 'Jabón de manos',      200,  20.0, 'LOTE-MAR-008', NULL),
  ('DON-2026-90008', 'Pañales adulto',       50,  60.0, 'LOTE-MAR-008', NULL)
) AS v(don_code, rt_name, qty, wkg, batch, expdate)
JOIN donations dn ON dn.donation_code = v.don_code
JOIN resource_types rt ON rt.name = v.rt_name
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECCIÓN 5 — Alert thresholds para cada resource_type (min_quantity = 50)
-- =============================================================================

INSERT INTO alert_thresholds (resource_type_id, min_quantity)
SELECT rt.id, 50
FROM resource_types rt
ON CONFLICT (resource_type_id) DO NOTHING;

-- =============================================================================
-- SECCIÓN 6 — Inventario inicial en bodegas (basado en donaciones IN_KIND)
-- Agrega el stock físico que las donaciones deberían haber ingresado.
-- Usa INSERT ... ON CONFLICT para ser idempotente.
-- =============================================================================

-- Bodega Cantaclaro: arroz y frijol
INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg, batch, expiration_date)
SELECT w.id, rt.id, v.qty, v.wkg, v.batch, v.expdate::date
FROM (VALUES
  ('Bodega Cantaclaro', 'Arroz blanco',  200, 200.0, 'LOTE-MAR-001', '2027-03-01'),
  ('Bodega Cantaclaro', 'Frijol rojo',   100, 100.0, 'LOTE-MAR-001', '2027-03-01'),
  ('Bodega Cantaclaro', 'Jabón de manos',100,  10.0, 'LOTE-MAR-008', NULL)
) AS v(wname, rtname, qty, wkg, batch, expdate)
JOIN warehouses w ON w.name = v.wname
JOIN resource_types rt ON rt.name = v.rtname
ON CONFLICT (warehouse_id, resource_type_id, batch) DO NOTHING;

-- Bodega Central Margen Izquierda: cobijas, colchonetas
INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg, batch, expiration_date)
SELECT w.id, rt.id, v.qty, v.wkg, v.batch, v.expdate::date
FROM (VALUES
  ('Bodega Central Margen Izquierda', 'Cobija doble',         150, 270.0, 'LOTE-MAR-002', NULL),
  ('Bodega Central Margen Izquierda', 'Colchoneta sencilla',   80, 280.0, 'LOTE-MAR-002', NULL),
  ('Bodega Central Margen Izquierda', 'Botiquín básico',        60,  60.0, 'LOTE-MAR-004', '2028-01-01'),
  ('Bodega Central Margen Izquierda', 'Suero oral',            500,  25.0, 'LOTE-MAR-004', '2027-06-01')
) AS v(wname, rtname, qty, wkg, batch, expdate)
JOIN warehouses w ON w.name = v.wname
JOIN resource_types rt ON rt.name = v.rtname
ON CONFLICT (warehouse_id, resource_type_id, batch) DO NOTHING;

-- Bodega Robinson Pitalúa: agua y atún
INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg, batch, expiration_date)
SELECT w.id, rt.id, v.qty, v.wkg, v.batch, v.expdate::date
FROM (VALUES
  ('Bodega Robinson Pitalúa', 'Agua potable',   400, 600.0, 'LOTE-MAR-005', '2026-09-01'),
  ('Bodega Robinson Pitalúa', 'Atún enlatado',  200,  36.0, 'LOTE-MAR-005', '2027-09-01'),
  ('Bodega Robinson Pitalúa', 'Pañales adulto',  50,  60.0, 'LOTE-MAR-008', NULL)
) AS v(wname, rtname, qty, wkg, batch, expdate)
JOIN warehouses w ON w.name = v.wname
JOIN resource_types rt ON rt.name = v.rtname
ON CONFLICT (warehouse_id, resource_type_id, batch) DO NOTHING;

-- Bodega El Poblado: arroz, pasta y jabón
INSERT INTO inventory (warehouse_id, resource_type_id, available_quantity, total_weight_kg, batch, expiration_date)
SELECT w.id, rt.id, v.qty, v.wkg, v.batch, v.expdate::date
FROM (VALUES
  ('Bodega El Poblado', 'Arroz blanco',  150, 150.0, 'LOTE-MAR-007', '2027-03-01'),
  ('Bodega El Poblado', 'Pasta',         100,  50.0, 'LOTE-MAR-007', '2027-06-01')
) AS v(wname, rtname, qty, wkg, batch, expdate)
JOIN warehouses w ON w.name = v.wname
JOIN resource_types rt ON rt.name = v.rtname
ON CONFLICT (warehouse_id, resource_type_id, batch) DO NOTHING;

-- Sincronizar current_weight_kg en bodegas con el inventario insertado
UPDATE warehouses wh
SET current_weight_kg = (
  SELECT COALESCE(SUM(i.total_weight_kg), 0)
  FROM inventory i
  WHERE i.warehouse_id = wh.id
)
WHERE wh.name IN (
  'Bodega Cantaclaro',
  'Bodega Central Margen Izquierda',
  'Bodega Robinson Pitalúa',
  'Bodega El Poblado'
);

-- =============================================================================
-- SECCIÓN 7 — Plan de distribución demo (PROGRAMADA)
-- 1 plan GLOBAL con items para las 3 familias de mayor puntaje.
-- distribution_plans: (plan_code, scope, scope_id, status, notes, created_by)
-- distribution_plan_items: (plan_id, family_id, source_warehouse_id,
--                           target_coverage_days, priority_score_snapshot, status)
-- =============================================================================

INSERT INTO distribution_plans (plan_code, scope, scope_id, status, notes, created_by)
SELECT
  'PLN-2026-90001',
  'GLOBAL',
  NULL,
  'PROGRAMADA',
  'Plan demo de distribución general — familias de mayor prioridad en Montería',
  u.id
FROM users u
WHERE u.email = 'admin@sigah.gov.co'
ON CONFLICT (plan_code) DO NOTHING;

-- Items del plan: las 3 familias con mayor priority_score entre las demo
INSERT INTO distribution_plan_items (
  plan_id, family_id, source_warehouse_id,
  target_coverage_days, priority_score_snapshot, status
)
SELECT
  p.id,
  top_families.id,
  w.id,
  7,
  top_families.priority_score,
  'PENDIENTE'
FROM distribution_plans p
CROSS JOIN (
  SELECT id, priority_score FROM families
  WHERE family_code LIKE 'FAM-2026-9%'
  ORDER BY priority_score DESC
  LIMIT 3
) top_families
CROSS JOIN warehouses w
WHERE p.plan_code = 'PLN-2026-90001'
  AND w.name = 'Bodega Cantaclaro'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECCIÓN 8 — Deliveries demo (5 ENTREGADA, 2 PROGRAMADA)
-- Depende de: familias (sección 2), bodegas (seed 004),
--             resource_types (seed 005).
-- Los códigos ENT-2026-9XXXX evitan colisión con códigos secuenciales reales.
-- =============================================================================

-- 5 entregas ENTREGADA (historial de distribución)
INSERT INTO deliveries (
  delivery_code, family_id, source_warehouse_id,
  coverage_days, status, delivery_date,
  received_by_document, notes, delivered_by
)
SELECT
  v.code,
  f.id,
  w.id,
  v.cvdays,
  'ENTREGADA'::delivery_status,
  v.ddate::timestamptz,
  f.head_document,
  v.notes,
  u.id
FROM (VALUES
  ('ENT-2026-90001', 'FAM-2026-90001', 'Bodega Cantaclaro',               7,  '2026-03-05', 'Primera entrega post-inundación'),
  ('ENT-2026-90002', 'FAM-2026-90003', 'Bodega Cantaclaro',               7,  '2026-03-05', 'Familia numerosa prioritaria'),
  ('ENT-2026-90003', 'FAM-2026-90025', 'Bodega Central Margen Izquierda', 7,  '2026-03-06', 'Familia en refugio - prioridad crítica'),
  ('ENT-2026-90004', 'FAM-2026-90008', 'Bodega Robinson Pitalúa',         7,  '2026-03-07', 'Entrega zona Robinson'),
  ('ENT-2026-90005', 'FAM-2026-90015', 'Bodega El Poblado',               7,  '2026-03-07', 'Entrega zona El Poblado')
) AS v(code, fam_code, wname, cvdays, ddate, notes)
JOIN families f ON f.family_code = v.fam_code
JOIN warehouses w ON w.name = v.wname
JOIN users u ON u.email = 'admin@sigah.gov.co'
ON CONFLICT (delivery_code) DO NOTHING;

-- 2 entregas PROGRAMADA (pendientes de ejecución)
INSERT INTO deliveries (
  delivery_code, family_id, source_warehouse_id,
  coverage_days, status, notes, delivered_by
)
SELECT
  v.code,
  f.id,
  w.id,
  v.cvdays,
  'PROGRAMADA'::delivery_status,
  v.notes,
  u.id
FROM (VALUES
  ('ENT-2026-90006', 'FAM-2026-90005', 'Bodega Cantaclaro',               7, 'Programada para próxima ronda'),
  ('ENT-2026-90007', 'FAM-2026-90026', 'Bodega Central Margen Izquierda', 7, 'Familia con discapacidades - pendiente')
) AS v(code, fam_code, wname, cvdays, notes)
JOIN families f ON f.family_code = v.fam_code
JOIN warehouses w ON w.name = v.wname
JOIN users u ON u.email = 'admin@sigah.gov.co'
ON CONFLICT (delivery_code) DO NOTHING;

-- Detalles de las entregas ENTREGADA
INSERT INTO delivery_details (delivery_id, resource_type_id, quantity, weight_kg, batch)
SELECT
  d.id, rt.id, v.qty, v.wkg, 'DEMO-BATCH'
FROM (VALUES
  ('ENT-2026-90001', 'Arroz blanco',  20, 20.0),
  ('ENT-2026-90001', 'Frijol rojo',   10, 10.0),
  ('ENT-2026-90002', 'Arroz blanco',  35, 35.0),
  ('ENT-2026-90002', 'Frijol rojo',   20, 20.0),
  ('ENT-2026-90003', 'Cobija doble',  10, 18.0),
  ('ENT-2026-90003', 'Arroz blanco',  25, 25.0),
  ('ENT-2026-90004', 'Agua potable',  30, 45.0),
  ('ENT-2026-90004', 'Atún enlatado', 20,  3.6),
  ('ENT-2026-90005', 'Arroz blanco',  25, 25.0),
  ('ENT-2026-90005', 'Pasta',         15,  7.5)
) AS v(del_code, rt_name, qty, wkg)
JOIN deliveries d ON d.delivery_code = v.del_code
JOIN resource_types rt ON rt.name = v.rt_name
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECCIÓN 9 — Health vectors demo (3 registros en zonas de mayor riesgo)
-- vector_type enum: 'AGUA_CONTAMINADA' | 'INSECTOS' | 'ROEDORES' | 'OTRO'
-- =============================================================================

INSERT INTO health_vectors (
  zone_id, shelter_id, vector_type,
  risk_level, reported_by, description
)
SELECT
  z.id,
  s.id,
  v.vtype::vector_type,
  v.risk_level::risk_level,
  u.id,
  v.description
FROM (VALUES
  ('Cantaclaro',              'I.E. Cantaclaro',          'INSECTOS',         'HIGH',     'Brote dengue detectado en sector norte — 12 casos reportados'),
  ('Margen Izquierda Centro', 'Coliseo Margen Izquierda', 'AGUA_CONTAMINADA', 'CRITICAL', 'Contaminación agua por desbordamiento — 8 casos gastroenteritis'),
  ('Mogambo',                 NULL,                        'ROEDORES',         'MEDIUM',   'Avistamiento roedores en zona de almacenaje temporal')
) AS v(zone_name, shelter_name, vtype, risk_level, description)
JOIN zones z ON z.name = v.zone_name
LEFT JOIN shelters s ON s.name = v.shelter_name AND s.zone_id = z.id
JOIN users u ON u.email = 'admin@sigah.gov.co';
