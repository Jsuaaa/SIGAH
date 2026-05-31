import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { auditLogsApi } from '@/api/auditLogs.api'
import type { AuditLogFilters } from '@/types/auditLog.types'

// HU-31 — Historial de auditoría (solo lectura) con filtros y paginación.
// keepPreviousData evita parpadeo al paginar/filtrar.
export function useAuditLogs(filters: Ref<AuditLogFilters>) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogsApi.list(filters.value),
    placeholderData: keepPreviousData,
  })
}
