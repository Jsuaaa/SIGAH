-- 005_resource_types_catalog.sql
-- Base catalog of resource_types referenced by donations and deliveries.
-- The unit_weight_kg values are the per-unit weights used by RN-01 to verify
-- the 0,6 kg/person/day floor on FOOD items, and by warehouses RN-03 to keep
-- current_weight_kg coherent with available_quantity.
-- Idempotent via ON CONFLICT (name, category).

INSERT INTO resource_types (name, category, unit_of_measure, unit_weight_kg) VALUES
    ('Arroz blanco',           'FOOD',       'kg',      1.0),
    ('Frijol rojo',            'FOOD',       'kg',      1.0),
    ('Pasta',                  'FOOD',       'kg',      0.5),
    ('Atún enlatado',          'FOOD',       'lata',    0.18),
    ('Aceite vegetal',         'FOOD',       'litro',   0.92),
    ('Agua potable',           'FOOD',       'botella', 1.5),
    ('Cobija doble',           'BLANKET',    'unidad',  1.8),
    ('Colchoneta sencilla',    'MATTRESS',   'unidad',  3.5),
    ('Jabón de manos',         'HYGIENE',    'unidad',  0.1),
    ('Pañales adulto',         'HYGIENE',    'paquete', 1.2),
    ('Toallas higiénicas',     'HYGIENE',    'paquete', 0.25),
    ('Botiquín básico',        'MEDICATION', 'unidad',  1.0),
    ('Suero oral',             'MEDICATION', 'sobre',   0.05)
ON CONFLICT (name, category) DO NOTHING;
