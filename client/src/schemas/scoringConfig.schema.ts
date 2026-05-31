import { z } from 'zod'
import { SCORING_CONFIG_KEYS, type ScoringConfigKey } from '@/types/scoringConfig.types'

// Coacción de input -> número (los campos del formulario son strings). Mismo
// patrón que schemas/family.schema.ts; deja pasar el valor original si no es un
// número finito para que Zod produzca el mensaje de tipo.
const numberFromInput = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return undefined
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isNaN(n) ? v : n
    }
    return v
  },
  z.number({ message: 'Debe ser un número' }),
)

// Peso (W_*): número finito >= 0.
const weight = numberFromInput.pipe(
  z.number().min(0, 'No puede ser negativo'),
)

// MAX_DAYS: entero >= 1 (tope de días).
const maxDays = numberFromInput.pipe(
  z.number().int('Debe ser un entero').min(1, 'Debe ser al menos 1'),
)

// Esquema del formulario completo: una clave por peso/factor.
export const scoringConfigSchema = z.object({
  W_MEMBERS: weight,
  W_CHILDREN_5: weight,
  W_ADULTS_65: weight,
  W_PREGNANT: weight,
  W_DISABLED: weight,
  W_ZONE_RISK: weight,
  W_DAYS_NO_AID: weight,
  W_DELIVERIES: weight,
  MAX_DAYS: maxDays,
})

export type ScoringConfigFormValues = z.infer<typeof scoringConfigSchema>

// Validador puntual de un peso (por si se quisiera validar campo a campo).
export function schemaForKey(key: ScoringConfigKey) {
  return key === 'MAX_DAYS' ? maxDays : weight
}

// Garantiza en compile-time que el esquema cubre todas las keys del backend.
type _AssertAllKeys = (typeof SCORING_CONFIG_KEYS)[number] extends keyof ScoringConfigFormValues
  ? true
  : never
const _assertAllKeys: _AssertAllKeys = true
void _assertAllKeys
