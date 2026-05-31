// Alertas de stock y umbrales configurables (HU-16, RF-13).
// Espejo de:
//   - server/db/procedures/inventory/fn_inventory_alerts.sql  → StockAlert (GET /inventory/alerts)
//   - server/db/procedures/alert_thresholds/fn_alert_thresholds_list.sql → AlertThreshold (GET /alert-thresholds)
//   - server/src/validators/alerts.validator.ts → AlertThresholdPayload (PUT /alert-thresholds)
//   - server/src/types/entities.ts (AlertKind / AlertSeverity / AlertThresholdEnriched)
//
// Las categorías de recurso se reutilizan desde resourceType.types.ts (fuente
// central del enum + etiquetas).

import type { ResourceCategory } from './resourceType.types'

// --- Alertas activas (GET /inventory/alerts) ---------------------------------

// Tipo de alerta tal como lo emite fn_inventory_alerts. HU-16 se centra en
// LOW_STOCK (stock por debajo del umbral), pero el endpoint agrega también
// alertas de vencimiento y de capacidad de bodega, así que las modelamos todas.
export type AlertKind = 'LOW_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | 'WAREHOUSE_OVER_85'

// Severidad calculada en el backend. El orden de gravedad es CRITICAL > HIGH > MEDIUM.
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

// Fila de alerta tal como la devuelve GET /inventory/alerts (fn_inventory_alerts).
// `metadata` es un JSONB cuyo contenido depende de `kind`; lo tipamos como un
// índice flexible y exponemos abajo las claves conocidas para LOW_STOCK.
export interface StockAlert {
  kind: AlertKind
  severity: AlertSeverity
  message: string
  // Enlace relativo a la bodega afectada, p.ej. "/warehouses/3" (CA3).
  link: string
  metadata: AlertMetadata
}

// Claves de `metadata` que emite fn_inventory_alerts. No todas existen en todas
// las alertas (varían por `kind`); por eso son opcionales.
export interface AlertMetadata {
  inventory_id?: number
  warehouse_id?: number
  warehouse_name?: string
  resource_type_id?: number
  resource_name?: string
  category?: ResourceCategory
  available_quantity?: number
  threshold?: number
  batch?: string
  expiration_date?: string | null
  days_remaining?: number
  current_weight_kg?: number
  max_capacity_kg?: number
  occupancy_ratio?: number
  [key: string]: unknown
}

// Etiquetas y estilos por severidad (CA1/CA3). Coherentes con la paleta de la
// app: rojo para crítico, ámbar para alto, neutro para medio.
export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
}

// Clases Tailwind por severidad para el badge de color (misma convención que
// los demás badges del proyecto: texto + fondo + borde por tono).
export const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  CRITICAL: 'text-danger bg-danger-bg border-danger-br',
  HIGH: 'text-warning bg-warning-bg border-warning-br',
  MEDIUM: 'text-neutral-700 bg-neutral-100 border-neutral-200',
}

// Peso de ordenación: CRITICAL primero (igual que el ORDER BY del backend).
export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
}

// Etiquetas por tipo de alerta (para distinguir LOW_STOCK de vencimientos, etc.).
export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  LOW_STOCK: 'Stock bajo',
  EXPIRING_SOON: 'Por vencer',
  EXPIRED: 'Vencido',
  WAREHOUSE_OVER_85: 'Bodega llena',
}

// --- Umbrales configurados (GET /alert-thresholds) ---------------------------

// Umbral mínimo por recurso tal como lo devuelve GET /alert-thresholds
// (fn_alert_thresholds_list). Incluye el snapshot del recurso embebido.
export interface AlertThreshold {
  id: number
  resource_type_id: number
  min_quantity: number
  updated_by: number | null
  updated_at: string
  resource: {
    id: number
    name: string
    category: ResourceCategory
    unit_of_measure: string
    unit_weight_kg: number
    is_active: boolean
  }
}

// Cuerpo del PUT /alert-thresholds (upsert por recurso, HU-16 CA2). Espejo de
// server/src/validators/alerts.validator.ts (setThresholdRules): ambos enteros,
// min_quantity >= 0.
export interface AlertThresholdPayload {
  resource_type_id: number
  min_quantity: number
}
