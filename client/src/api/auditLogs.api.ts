import { api } from './axios'
import type { ApiList } from '@/types/api.types'
import type { AuditLog, AuditListParams } from '@/types/audit.types'

export const auditLogsApi = {
  list(params: AuditListParams) {
    const query: Record<string, string | number> = { page: params.page, limit: params.limit }
    if (params.module) query.module = params.module
    if (params.action) query.action = params.action
    if (params.user_id) query.user_id = params.user_id
    if (params.entity) query.entity = params.entity
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return api.get<ApiList<AuditLog>>('/audit-logs', { params: query }).then((r) => r.data)
  },
}
