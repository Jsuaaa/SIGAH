// Tipos del log de auditoría inmutable (HU-31, RNF-09).

export interface AuditLog {
  id: number
  action: string
  module: string
  entity: string
  entity_id: number | null
  user_id: number | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditListParams {
  page: number
  limit: number
  module?: string
  action?: string
  user_id?: number
  entity?: string
  date_from?: string
  date_to?: string
}

// Acciones comunes (el backend acepta texto libre, pero estas cubren el caso típico).
export const AUDIT_ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'STATUS_CHANGE'].map((a) => ({
  value: a,
  label: a,
}))
