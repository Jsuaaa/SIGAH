/**
 * Tipos para el historial de auditoría (HU-31).
 * Estructura confirmada en server/db/procedures/audit/fn_audit_list.sql,
 * server/src/views/auditLog.view.ts (devuelve la fila cruda) y la tabla
 * audit_logs. La tabla es append-only: solo lectura.
 *
 * Nota: el backend NO devuelve nombre/email del usuario, solo user_id; tampoco
 * existe un campo `changes` unificado: el diff son dos columnas before/after.
 */

/** Estado de una entidad antes/después de la acción (columnas JSONB). */
export type AuditSnapshot = Record<string, unknown> | null

export interface AuditLog {
  id: number
  action: string
  module: string
  entity: string | null
  entity_id: number | null
  user_id: number | null
  before: AuditSnapshot
  after: AuditSnapshot
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// Filtros aceptados por el backend (validators/auditLogs.validator.ts):
// user_id, entity_id, module, action, entity, date_from, date_to, page, limit.
export interface AuditLogFilters {
  user_id?: number
  module?: string
  action?: string
  entity?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}
