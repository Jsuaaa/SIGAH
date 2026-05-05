-- 003_shelters_monteria.sql
-- Real shelters set up on the left bank of the Sinú river during the 2026
-- flood. Idempotent via ON CONFLICT (name, zone_id). Depends on the zones
-- seeded by 002_zones_monteria.sql.

INSERT INTO shelters (name, address, zone_id, max_capacity, current_occupancy, type, latitude, longitude)
SELECT v.name, v.address, z.id, v.max_capacity, v.current_occupancy, v.type::shelter_type, v.latitude, v.longitude
  FROM (VALUES
        ('I.E. Cantaclaro',              'Cl. 41 #14-22, Cantaclaro',         'Cantaclaro',              500, 320, 'SCHOOL',           8.7325, -75.8970),
        ('Coliseo Margen Izquierda',     'Av. Circunvalar, Margen Izquierda', 'Margen Izquierda Centro', 800, 720, 'STADIUM',          8.7500, -75.9055),
        ('Iglesia San Pedro Robinson',   'Cl. 22 #18-10, Robinson Pitalúa',   'Robinson Pitalúa',        250, 180, 'CHURCH',           8.7418, -75.9015),
        ('Centro Comunal El Poblado',    'Cra. 15 #30-05, El Poblado',        'El Poblado',              300, 210, 'COMMUNITY_CENTER', 8.7592, -75.9138),
        ('Campamento Mogambo Norte',     'Sector Mogambo Norte',              'Mogambo',                 150,  90, 'TENT',             8.7208, -75.8848)
       ) AS v(name, address, zone_name, max_capacity, current_occupancy, type, latitude, longitude)
  JOIN zones z ON z.name = v.zone_name
ON CONFLICT (name, zone_id) DO NOTHING;
