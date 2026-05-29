import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { ScoringConfigKey, ScoringConfigRow } from '@/types/prioritization.types'

export const scoringConfigApi = {
  list() {
    return api.get<ApiItem<ScoringConfigRow[]>>('/scoring-config').then((r) => r.data.data)
  },

  // PUT /scoring-config acepta un par { key, value } por llamada (ADMIN/COORD).
  set(key: ScoringConfigKey, value: number) {
    return api.put<ApiItem<ScoringConfigRow>>('/scoring-config', { key, value }).then((r) => r.data.data)
  },
}
