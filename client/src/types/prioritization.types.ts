// Tipos de priorización y configuración del puntaje (HU-08).
import type { FamilyStatus } from './family.types'

// Fila del ranking (GET /prioritization/ranking). priority_score_breakdown tiene
// la forma de FamilyScoreBreakdown (ver family.types.ts).
export interface RankingRow {
  id: number
  family_code: string
  head_document: string
  zone_id: number
  zone_name: string
  shelter_id: number | null
  num_members: number
  num_children_under_5: number
  num_adults_over_65: number
  num_pregnant: number
  num_disabled: number
  priority_score: number
  priority_score_breakdown: Record<string, unknown>
  status: FamilyStatus
  last_delivery_date: string | null
}

export interface RankingParams {
  page: number
  limit: number
  zone_id?: number
  status?: FamilyStatus
}

// --- Configuración del puntaje (scoring-config) -------------------------------
export type ScoringConfigKey =
  | 'W_MEMBERS'
  | 'W_CHILDREN_5'
  | 'W_ADULTS_65'
  | 'W_PREGNANT'
  | 'W_DISABLED'
  | 'W_ZONE_RISK'
  | 'W_DAYS_NO_AID'
  | 'W_DELIVERIES'
  | 'MAX_DAYS'

export interface ScoringConfigRow {
  key: ScoringConfigKey
  value: number
  updated_by: number | null
  updated_at: string
}

// Etiqueta + descripción de cada peso, en el orden de presentación del editor.
export const SCORING_CONFIG_FIELDS: { key: ScoringConfigKey; label: string; description: string }[] = [
  { key: 'W_MEMBERS', label: 'Peso por integrante', description: 'Puntos por cada miembro del núcleo familiar.' },
  { key: 'W_CHILDREN_5', label: 'Peso por niño < 5', description: 'Puntos por cada menor de 5 años.' },
  { key: 'W_ADULTS_65', label: 'Peso por adulto > 65', description: 'Puntos por cada adulto mayor de 65 años.' },
  { key: 'W_PREGNANT', label: 'Peso por gestante', description: 'Puntos por cada gestante.' },
  { key: 'W_DISABLED', label: 'Peso por discapacidad', description: 'Puntos por cada persona con discapacidad.' },
  { key: 'W_ZONE_RISK', label: 'Peso por riesgo de zona', description: 'Multiplica el factor de riesgo de la zona (1 a 4).' },
  { key: 'W_DAYS_NO_AID', label: 'Peso por día sin ayuda', description: 'Puntos por cada día sin recibir ayuda (hasta el tope).' },
  { key: 'W_DELIVERIES', label: 'Penalización por entrega', description: 'Resta puntos por cada entrega ya recibida.' },
  { key: 'MAX_DAYS', label: 'Tope de días sin ayuda', description: 'Máximo de días sin ayuda que se contabilizan.' },
]
