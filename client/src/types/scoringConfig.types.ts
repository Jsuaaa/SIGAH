// Configuración de pesos del algoritmo de priorización (HU-08).
// Las filas de scoring_config son planas (key/value), tal como las expone el
// backend en GET /scoring-config. El backend solo edita el valor; las keys las
// siembra la migración 008 y no hay API para crear nuevas.
// Ver server/src/types/entities.ts (ScoringConfigKey) y
// server/db/procedures/prioritization/fn_priority_score.sql (uso de cada peso).

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

// Orden de presentación en el formulario (coincide con el seed de la migración).
export const SCORING_CONFIG_KEYS: readonly ScoringConfigKey[] = [
  'W_MEMBERS',
  'W_CHILDREN_5',
  'W_ADULTS_65',
  'W_PREGNANT',
  'W_DISABLED',
  'W_ZONE_RISK',
  'W_DAYS_NO_AID',
  'W_DELIVERIES',
  'MAX_DAYS',
] as const

// Fila tal como la devuelve GET /scoring-config (fn_scoring_config_list).
// `updated_at` llega como string ISO desde la API.
export interface ScoringConfigRow {
  key: ScoringConfigKey
  value: number
  updated_by: number | null
  updated_at: string
}

// Cuerpo de PUT /scoring-config. OJO: el backend real (scoringConfig.validator +
// controller.set) edita UN solo peso por petición con un cuerpo plano { key, value }
// — NO un arreglo `entries` como sugiere el comentario swagger de la ruta.
export interface ScoringConfigUpdatePayload {
  key: ScoringConfigKey
  value: number
}

// Etiqueta en español + ayuda por peso/factor. El texto reutiliza el del
// desglose de puntaje que ya existe en el detalle de familia (FamilyDetailPage).
export interface ScoringConfigFieldMeta {
  label: string
  hint: string
  // MAX_DAYS es un tope en días (entero >= 1); el resto son pesos (>= 0).
  integer?: boolean
}

export const SCORING_CONFIG_LABELS: Record<ScoringConfigKey, ScoringConfigFieldMeta> = {
  W_MEMBERS: {
    label: 'Peso por integrante',
    hint: 'Multiplica el número de integrantes de la familia.',
  },
  W_CHILDREN_5: {
    label: 'Peso por menor de 5 años',
    hint: 'Multiplica el número de menores de 5 años.',
  },
  W_ADULTS_65: {
    label: 'Peso por adulto mayor de 65',
    hint: 'Multiplica el número de adultos mayores de 65.',
  },
  W_PREGNANT: {
    label: 'Peso por embarazada',
    hint: 'Multiplica el número de mujeres embarazadas.',
  },
  W_DISABLED: {
    label: 'Peso por persona con discapacidad',
    hint: 'Multiplica el número de personas con discapacidad.',
  },
  W_ZONE_RISK: {
    label: 'Peso por riesgo de zona',
    hint: 'Multiplica el factor de riesgo de la zona (Bajo=1 a Crítico=4).',
  },
  W_DAYS_NO_AID: {
    label: 'Peso por días sin ayuda',
    hint: 'Multiplica los días sin ayuda (limitados por el tope máximo).',
  },
  W_DELIVERIES: {
    label: 'Peso por entregas recibidas',
    hint: 'Resta del puntaje según el número de entregas recibidas.',
  },
  MAX_DAYS: {
    label: 'Tope de días sin ayuda',
    hint: 'Límite máximo de días sin ayuda que se consideran en el cálculo.',
    integer: true,
  },
}

// Valores por defecto del seed (migración 008_scoring_config.sql), como
// referencia en la UI.
export const SCORING_CONFIG_DEFAULTS: Record<ScoringConfigKey, number> = {
  W_MEMBERS: 2,
  W_CHILDREN_5: 5,
  W_ADULTS_65: 4,
  W_PREGNANT: 5,
  W_DISABLED: 4,
  W_ZONE_RISK: 3,
  W_DAYS_NO_AID: 1.5,
  W_DELIVERIES: 2,
  MAX_DAYS: 30,
}
