import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type { ScoringConfigRow, ScoringConfigUpdatePayload } from '@/types/scoringConfig.types'

// Capa de acceso a /scoring-config (HU-08). GET devuelve todas las filas;
// PUT edita UN peso por petición (cuerpo plano { key, value }, ver
// scoringConfig.types.ts). Roles de edición: ADMIN / COORDINADOR_LOGISTICA.
export const scoringConfigApi = {
  get() {
    return api.get<ApiList<ScoringConfigRow>>('/scoring-config').then((r) => r.data.data)
  },

  update(payload: ScoringConfigUpdatePayload) {
    return api.put<ApiItem<ScoringConfigRow>>('/scoring-config', payload).then((r) => r.data.data)
  },
}
