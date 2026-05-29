import { z } from 'zod'

// Formulario del catálogo de tipos de recurso (HU-14).
export const resourceTypeSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  category: z.enum(['FOOD', 'BLANKET', 'MATTRESS', 'HYGIENE', 'MEDICATION'], {
    message: 'Selecciona la categoría',
  }),
  unit_of_measure: z.string().trim().min(1, 'Requerida').max(30, 'Máximo 30 caracteres'),
  unit_weight_kg: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Ingresa el peso unitario' }).min(0, 'No puede ser negativo'),
  ),
})

export type ResourceTypeFormValues = z.infer<typeof resourceTypeSchema>
