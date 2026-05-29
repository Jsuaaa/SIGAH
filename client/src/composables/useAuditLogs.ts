import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { auditLogsApi } from '@/api/auditLogs.api'
import type { AuditListParams } from '@/types/audit.types'

export function useAuditLogs(params: Ref<AuditListParams>) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditLogsApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}
