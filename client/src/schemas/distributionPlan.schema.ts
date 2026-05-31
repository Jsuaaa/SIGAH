import { z } from 'zod'

// Validación de la creación de un plan de distribución (HU-21). Refleja
// createPlanRules del backend (server/src/validators/distributionPlans.validator.ts)
// y las reglas de negocio del SP sp_distribution_plans_create:
//   - scope obligatorio y en enum.
//   - target_coverage_days entero >= 3 (RN-01).
//   - scope_id obligatorio para ZONA/REFUGIO; ignorado en GLOBAL/LOTE.
//   - family_ids: arreglo no vacío de enteros, obligatorio cuando scope = LOTE.
// Se valida en submit (patrón único de la app, sin VeeValidate).
export const distributionPlanCreateSchema = z
  .object({
    scope: z.enum(['GLOBAL', 'ZONA', 'REFUGIO', 'LOTE']),
    target_coverage_days: z.coerce
      .number()
      .int('Los días de cobertura deben ser un entero')
      .min(3, 'La cobertura objetivo debe ser de al menos 3 días (RN-01)'),
    scope_id: z.coerce.number().int().positive().optional().nullable(),
    family_ids: z.array(z.coerce.number().int().positive()).optional(),
    notes: z
      .string()
      .trim()
      .max(2000, 'Las notas no pueden superar 2000 caracteres')
      .optional()
      .nullable()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // scope_id obligatorio cuando el alcance es ZONA o REFUGIO.
    if ((data.scope === 'ZONA' || data.scope === 'REFUGIO') && !data.scope_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope_id'],
        message:
          data.scope === 'ZONA' ? 'Selecciona la zona del plan.' : 'Selecciona el refugio del plan.',
      })
    }
    // family_ids obligatorio (>=1) cuando el alcance es LOTE.
    if (data.scope === 'LOTE' && (!data.family_ids || data.family_ids.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['family_ids'],
        message: 'Selecciona al menos una familia para el lote.',
      })
    }
  })

export type DistributionPlanCreateInput = z.infer<typeof distributionPlanCreateSchema>
