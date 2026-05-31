import { z } from 'zod'
import {
  VECTOR_TYPE_OPTIONS,
  HEALTH_VECTOR_STATUS_OPTIONS,
  type VectorType,
  type HealthVectorStatus,
} from '@/types/healthVector.types'
import { RISK_LEVEL_OPTIONS, type RiskLevel } from '@/types/zone.types'

const VECTOR_TYPE_VALUES = VECTOR_TYPE_OPTIONS.map((o) => o.value) as [
  VectorType,
  ...VectorType[],
]
const RISK_LEVEL_VALUES = RISK_LEVEL_OPTIONS.map((o) => o.value) as [RiskLevel, ...RiskLevel[]]
const STATUS_VALUES = HEALTH_VECTOR_STATUS_OPTIONS.map((o) => o.value) as [
  HealthVectorStatus,
  ...HealthVectorStatus[],
]

// Espejo de server/src/validators/healthVectors.validator.ts (createRules /
// updateRules). Validación en submit. La regla de ubicación (al menos zona,
// refugio o coordenadas — SH422) se valida en la página, porque combina campos
// que provienen de un SelectField y del MapPicker.
//   vector_type : enum vector_type (obligatorio en alta).
//   risk_level  : enum risk_level (obligatorio en alta).
//   description : opcional, máx. 2000 caracteres.
//   zone_id     : opcional, entero positivo.
export const healthVectorSchema = z.object({
  vector_type: z.enum(VECTOR_TYPE_VALUES, { message: 'Selecciona el tipo de vector' }),
  risk_level: z.enum(RISK_LEVEL_VALUES, { message: 'Selecciona el nivel de riesgo' }),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional(),
  zone_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).optional(),
  ),
})

export type HealthVectorFormValues = z.infer<typeof healthVectorSchema>

// HU-25 CA3 — cambio de estado: status obligatorio y actions_taken obligatorio
// (la UI exige registrar las acciones tomadas al cambiar el estado).
export const healthVectorStatusSchema = z.object({
  status: z.enum(STATUS_VALUES, { message: 'Selecciona el estado' }),
  actions_taken: z
    .string()
    .trim()
    .min(3, 'Registra las acciones tomadas (mínimo 3 caracteres)')
    .max(2000, 'Máximo 2000 caracteres'),
})

export type HealthVectorStatusFormValues = z.infer<typeof healthVectorStatusSchema>
