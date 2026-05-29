// Tipos del módulo de planes de distribución (HU-21).

export type DistributionPlanStatus = 'PROGRAMADA' | 'EN_EJECUCION' | 'COMPLETADA' | 'CANCELADA'
export type DistributionPlanScope = 'GLOBAL' | 'ZONA' | 'REFUGIO' | 'LOTE'
export type DistributionPlanItemStatus = 'PENDIENTE' | 'ENTREGADO' | 'SIN_ATENDER'

export const PLAN_STATUS_LABELS: Record<DistributionPlanStatus, string> = {
  PROGRAMADA: 'Programada',
  EN_EJECUCION: 'En ejecución',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

export const PLAN_SCOPE_OPTIONS: { value: DistributionPlanScope; label: string }[] = [
  { value: 'GLOBAL', label: 'Global (todas las familias)' },
  { value: 'ZONA', label: 'Por zona' },
  { value: 'REFUGIO', label: 'Por refugio' },
  { value: 'LOTE', label: 'Lote (familias específicas)' },
]
export const PLAN_SCOPE_LABELS = Object.fromEntries(
  PLAN_SCOPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DistributionPlanScope, string>

export const PLAN_ITEM_STATUS_LABELS: Record<DistributionPlanItemStatus, string> = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Entregado',
  SIN_ATENDER: 'Sin atender',
}

export const PLAN_STATUS_OPTIONS = (Object.keys(PLAN_STATUS_LABELS) as DistributionPlanStatus[]).map(
  (value) => ({ value, label: PLAN_STATUS_LABELS[value] }),
)

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
}

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
}

export interface DistributionPlanWithItems extends DistributionPlan {
  items?: DistributionPlanItem[]
  items_total?: number
  items_pendientes?: number
  items_entregados?: number
  items_sin_atender?: number
}

export interface PlanListParams {
  page: number
  limit: number
  status?: DistributionPlanStatus
  scope?: DistributionPlanScope
}

export interface CreatePlanPayload {
  scope: DistributionPlanScope
  target_coverage_days: number
  scope_id?: number | null
  family_ids?: number[]
  notes?: string | null
}
