-- 004_warehouses_monteria.sql
-- Real warehouses set up for the 2026 left-bank flood response. The PDF
-- specifies a centralized capacity of 20.000 kg distributed across these
-- nodes. Idempotent via ON CONFLICT (name). Depends on the zones seeded by
-- 002_zones_monteria.sql.

INSERT INTO warehouses (name, address, zone_id, max_capacity_kg, current_weight_kg, status, latitude, longitude)
SELECT v.name, v.address, z.id, v.max_capacity_kg, v.current_weight_kg, v.status::warehouse_status, v.latitude, v.longitude
  FROM (VALUES
        ('Bodega Central Margen Izquierda', 'Av. Circunvalar #25-10', 'Margen Izquierda Centro', 10000, 6500, 'ACTIVE',  8.7505, -75.9060),
        ('Bodega Cantaclaro',               'Cl. 41 #14-22',          'Cantaclaro',              5000, 3200, 'ACTIVE',  8.7330, -75.8975),
        ('Bodega Robinson Pitalúa',         'Cra. 18 #22-15',         'Robinson Pitalúa',        3000, 1100, 'ACTIVE',  8.7420, -75.9020),
        ('Bodega El Poblado',               'Cra. 15 #30-05',         'El Poblado',              2000,  900, 'ACTIVE',  8.7595, -75.9140)
       ) AS v(name, address, zone_name, max_capacity_kg, current_weight_kg, status, latitude, longitude)
  JOIN zones z ON z.name = v.zone_name
ON CONFLICT (name) DO NOTHING;
