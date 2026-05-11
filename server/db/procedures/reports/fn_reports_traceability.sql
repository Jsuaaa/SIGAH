-- fn_reports_traceability(p_donation_id, p_resource_type_id, p_from, p_to)
-- Rastrea la cadena: donante → donación → bodega → entrega → familia.
-- Si se pasa p_donation_id, filtra esa donación específica.
-- Si se pasa p_resource_type_id, filtra todas las donaciones de ese recurso en el rango.
-- HU-29 CA1-CA3, Issue #31

CREATE OR REPLACE FUNCTION fn_reports_traceability(
  p_donation_id      BIGINT DEFAULT NULL,
  p_resource_type_id BIGINT DEFAULT NULL,
  p_from             DATE   DEFAULT NULL,
  p_to               DATE   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH
  -- Donaciones filtradas según los parámetros de entrada
  target_donations AS (
    SELECT DISTINCT don.id AS donation_id
    FROM donations don
    LEFT JOIN donation_details dd ON dd.donation_id = don.id
    WHERE
      -- Filtro por donation_id específico
      (p_donation_id IS NULL OR don.id = p_donation_id)
      -- Filtro por resource_type cuando se pide trazabilidad por tipo
      AND (p_resource_type_id IS NULL OR dd.resource_type_id = p_resource_type_id)
      -- Filtros de rango de fecha
      AND (p_from IS NULL OR don.date::date >= p_from)
      AND (p_to   IS NULL OR don.date::date <= p_to)
  ),
  -- Construimos la estructura anidada por donación
  donation_chain AS (
    SELECT
      don.id              AS donation_id,
      don.donation_code,
      don.donation_type,
      don.monetary_amount,
      don.date            AS donation_date,
      -- Donante
      jsonb_build_object(
        'id',      dr.id,
        'name',    dr.name,
        'type',    dr.type,
        'contact', dr.contact
      ) AS donor,
      -- Bodega destino
      jsonb_build_object(
        'id',      w.id,
        'name',    w.name,
        'address', w.address,
        'zone_id', w.zone_id
      ) AS warehouse,
      -- Detalles de la donación
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'resource_type_id',   dd.resource_type_id,
          'resource_type_name', rt.name,
          'category',           rt.category,
          'quantity',           dd.quantity,
          'weight_kg',          dd.weight_kg
        ))
        FROM donation_details dd
        JOIN resource_types rt ON rt.id = dd.resource_type_id
        WHERE dd.donation_id = don.id
          AND (p_resource_type_id IS NULL OR dd.resource_type_id = p_resource_type_id)
      ), '[]'::jsonb) AS donation_details,
      -- Entregas derivadas de esta donación (vía bodega origen)
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'delivery_id',   del.id,
          'delivery_code', del.delivery_code,
          'delivery_date', del.delivery_date,
          'status',        del.status,
          'coverage_days', del.coverage_days,
          'family', jsonb_build_object(
            'id',          f.id,
            'family_code', f.family_code,
            'zone_id',     f.zone_id,
            'num_members', f.num_members,
            'status',      f.status
          ),
          'details', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'resource_type_id',   deld.resource_type_id,
              'resource_type_name', rte.name,
              'quantity',           deld.quantity,
              'weight_kg',          deld.weight_kg
            ))
            FROM delivery_details deld
            JOIN resource_types rte ON rte.id = deld.resource_type_id
            WHERE deld.delivery_id = del.id
              AND (p_resource_type_id IS NULL OR deld.resource_type_id = p_resource_type_id)
          ), '[]'::jsonb)
        ) ORDER BY del.delivery_date)
        FROM deliveries del
        JOIN families f ON f.id = del.family_id
        WHERE del.source_warehouse_id = don.destination_warehouse_id
          AND (p_from IS NULL OR del.delivery_date::date >= p_from)
          AND (p_to   IS NULL OR del.delivery_date::date <= p_to)
          -- Solo incluir entregas que tienen el resource_type buscado (cuando aplica)
          AND (
            p_resource_type_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM delivery_details dd2
              WHERE dd2.delivery_id = del.id
                AND dd2.resource_type_id = p_resource_type_id
            )
          )
      ), '[]'::jsonb) AS deliveries
    FROM target_donations td
    JOIN donations  don ON don.id = td.donation_id
    JOIN donors     dr  ON dr.id  = don.donor_id
    JOIN warehouses w   ON w.id   = don.destination_warehouse_id
  )
  SELECT jsonb_build_object(
    'donations', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'donation_id',      dc.donation_id,
          'donation_code',    dc.donation_code,
          'donation_type',    dc.donation_type,
          'monetary_amount',  dc.monetary_amount,
          'donation_date',    dc.donation_date,
          'donor',            dc.donor,
          'warehouse',        dc.warehouse,
          'details',          dc.donation_details,
          'deliveries',       dc.deliveries
        )
        ORDER BY dc.donation_date
      ),
      '[]'::jsonb
    )
  )
  FROM donation_chain dc;
$$;
