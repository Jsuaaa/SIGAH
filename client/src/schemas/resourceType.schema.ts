import { z } from 'zod'

// Espejo de server/src/validators/resourceTypes.validator.ts. Validación en submit.
//   name            : 2–120 caracteres.
//   category        : enum resource_category.
//   unit_of_measure : 1–30 caracteres.
//   unit_weight_kg  : número >= 0 (z.preprocess para convertir el string del input).
export const resourceTypeSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  category: z.enum(['FOOD', 'BLANKET', 'MATTRESS', 'HYGIENE', 'MEDICATION'], {
    message: 'Selecciona la categoría',
  }),
  unit_of_measure: z
    .string()
    .trim()
    .min(1, 'Ingresa la unidad de medida')
    .max(30, 'Máximo 30 caracteres'),
  unit_weight_kg: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ message: 'Ingresa el peso unitario' })
      .nonnegative('No puede ser negativo'),
  ),
})

export type ResourceTypeFormValues = z.infer<typeof resourceTypeSchema>
