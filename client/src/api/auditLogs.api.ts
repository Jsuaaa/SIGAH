import { api } from './axios'
import type { ApiList } from '@/types/api.types'
import type { AuditLog, AuditLogFilters } from '@/types/auditLog.types'

/** Construye query params descartando valores vacíos/undefined/null. */
function buildParams(filters: object): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value)
    }
  }
  return params
}

export const auditLogsApi = {
  // GET /audit-logs — log inmutable, solo lectura. Respuesta: { success, data, pagination }.
  list(filters: AuditLogFilters = {}) {
    return api
      .get<ApiList<AuditLog>>('/audit-logs', { params: buildParams(filters) })
      .then((r) => r.data)
  },
}
