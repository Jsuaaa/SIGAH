import { api } from './axios'
import type { ApiItem } from '@/types/api.types'

export interface SyncOpInput {
  client_op_id: string
  method: string
  url: string
  payload: unknown
}

export interface SyncOpResult {
  client_op_id: string
  status_code: number
  response: unknown
  from_cache: boolean
}

export const syncApi = {
  // POST /sync — procesa el lote de ops offline (dedup por client_op_id en el backend).
  processBatch(ops: SyncOpInput[]) {
    return api.post<ApiItem<SyncOpResult[]>>('/sync', { ops }).then((r) => r.data.data)
  },
}
