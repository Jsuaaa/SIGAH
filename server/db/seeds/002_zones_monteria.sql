-- 002_zones_monteria.sql
-- Real neighborhoods on the left bank of the Sinú river in Montería affected
-- by the 2026 flood. Idempotent via ON CONFLICT (name).

INSERT INTO zones (name, risk_level, latitude, longitude, estimated_population) VALUES
    ('Cantaclaro',              'CRITICAL', 8.7320, -75.8967, 18000),
    ('Robinson Pitalúa',        'HIGH',     8.7415, -75.9012, 12500),
    ('El Poblado',              'HIGH',     8.7589, -75.9134, 9800),
    ('Mogambo',                 'MEDIUM',   8.7203, -75.8845, 6200),
    ('Margen Izquierda Centro', 'CRITICAL', 8.7497, -75.9050, 22000)
ON CONFLICT (name) DO NOTHING;
