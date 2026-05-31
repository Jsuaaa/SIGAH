// Planes de distribución — HU-21 (RF-18). Espejo del contrato del backend:
//   - ENUMs distribution_plan_status / scope / item_status:
//     server/src/types/entities.ts y server/db/migrations/016_distribution_plans.sql.
//   - Cuerpo del POST: server/src/validators/distributionPlans.validator.ts y
//     server/db/procedures/distribution_plans/sp_distribution_plans_create.sql.
//   - Vista de listado: fn_distribution_plans_list.sql (cada fila trae las columnas
//     de `distribution_plans` + contadores items_*).
//   - Detalle con items embebidos: fn_distribution_plans_find_by_id.sql.
// Los valores de los enums NO se traducen; solo la etiqueta visible.

// --- Estados del plan ---------------------------------------------------------
export type DistributionPlanStatus = 'PROGRAMADA' | 'EN_EJECUCION' | 'COMPLETADA' | 'CANCELADA'

export const DISTRIBUTION_PLAN_STATUS_LABELS: Record<DistributionPlanStatus, string> = {
  PROGRAMADA: 'Programada',
  EN_EJECUCION: 'En ejecución',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

// Clases Tailwind por estado (mismo lenguaje visual que los demás badges).
export const DISTRIBUTION_PLAN_STATUS_BADGE: Record<DistributionPlanStatus, string> = {
  PROGRAMADA: 'text-state-programada bg-neutral-100 border-neutral-200',
  EN_EJECUCION: 'text-primary-700 bg-info-bg border-info-br',
  COMPLETADA: 'text-success bg-success-bg border-success-br',
  CANCELADA: 'text-danger bg-danger-bg border-danger-br',
}

// --- Alcance del plan ---------------------------------------------------------
export type DistributionPlanScope = 'GLOBAL' | 'ZONA' | 'REFUGIO' | 'LOTE'

export const DISTRIBUTION_PLAN_SCOPE_OPTIONS: { value: DistributionPlanScope; label: string; hint: string }[] = [
  { value: 'GLOBAL', label: 'Global', hint: 'Todas las familias activas o en refugio.' },
  { value: 'ZONA', label: 'Zona', hint: 'Las familias de una zona específica.' },
  { value: 'REFUGIO', label: 'Refugio', hint: 'Las familias de un refugio específico.' },
  { value: 'LOTE', label: 'Lote', hint: 'Un conjunto manual de familias seleccionadas.' },
]

export const DISTRIBUTION_PLAN_SCOPE_LABELS = Object.fromEntries(
  DISTRIBUTION_PLAN_SCOPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DistributionPlanScope, string>

// --- Estado de cada item del plan ---------------------------------------------
export type DistributionPlanItemStatus = 'PENDIENTE' | 'ENTREGADO' | 'SIN_ATENDER'

export const DISTRIBUTION_PLAN_ITEM_STATUS_LABELS: Record<DistributionPlanItemStatus, string> = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Entregado',
  SIN_ATENDER: 'Sin atender',
}

export const DISTRIBUTION_PLAN_ITEM_STATUS_BADGE: Record<DistributionPlanItemStatus, string> = {
  PENDIENTE: 'text-state-programada bg-neutral-100 border-neutral-200',
  ENTREGADO: 'text-success bg-success-bg border-success-br',
  SIN_ATENDER: 'text-warning bg-warning-bg border-warning-br',
}

// Plan tal como lo devuelve GET /distribution-plans (cada fila). created_at/updated_at
// llegan como string ISO (el backend los serializa). Los contadores items_* los añade
// fn_distribution_plans_list y solo vienen en el listado.
export interface DistributionPlan {
  id: number
  plan_code: string
  created_by: number
  status: DistributionPlanStatus
  scope: DistributionPlanScope
  scope_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
  // Contadores agregados (solo en el listado).
  items_total?: number
  items_pendientes?: number
  items_entregados?: number
  items_sin_atender?: number
}

// Item (renglón) de un plan, embebido en GET /distribution-plans/:id (`items`).
// reason trae el motivo cuando status = SIN_ATENDER (p. ej. 'INSUFFICIENT_STOCK'
// o 'INELIGIBLE: ...'). priority_score_snapshot es el puntaje al generar el plan.
export interface DistributionPlanItem {
  id: number
  plan_id: number
  family_id: number
  source_warehouse_id: number | null
  target_coverage_days: number
  priority_score_snapshot: number
  status: DistributionPlanItemStatus
  delivery_id: number | null
  reason: string | null
  created_at: string
  updated_at: string
}

// Plan con sus items (GET /distribution-plans/:id).
export interface DistributionPlanWithItems extends DistributionPlan {
  items: DistributionPlanItem[]
}

// Cuerpo de POST /distribution-plans. Campos EXACTOS del validador del backend
// (createPlanRules) y del SP sp_distribution_plans_create:
//   - scope: obligatorio.
//   - target_coverage_days: entero >= 3 (RN-01).
//   - scope_id: obligatorio para ZONA/REFUGIO (id de zona o refugio); ignorado en
//     GLOBAL/LOTE.
//   - family_ids: arreglo no vacío de ids, obligatorio cuando scope = LOTE.
//   - notes: opcional (máx 2000).
// El backend genera el plan con sus items YA creados (status PROGRAMADA) y devuelve
// la fila del plan (sin items).
export interface DistributionPlanPayload {
  scope: DistributionPlanScope
  target_coverage_days: number
  scope_id?: number | null
  family_ids?: number[] | null
  notes?: string | null
}

// Parámetros de GET /distribution-plans (controller.list): paginación + filtros
// opcionales por estado, alcance y usuario creador. Nombres exactos del controller.
export interface DistributionPlanListParams {
  page: number
  limit: number
  status?: DistributionPlanStatus
  scope?: DistributionPlanScope
  created_by?: number
}
