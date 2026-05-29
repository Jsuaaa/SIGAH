import { z } from 'zod'

// Campos del formulario de persona (integrante de familia). Refleja POST /persons.
export const personSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  document: z.string().trim().min(5, 'Mínimo 5 caracteres').max(30, 'Máximo 30 caracteres'),
  birth_date: z
    .string()
    .min(1, 'Ingresa la fecha de nacimiento')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Fecha inválida')
    .refine((v) => new Date(v) <= new Date(), 'La fecha no puede ser futura'),
  gender: z.enum(['M', 'F', 'OTRO'], { message: 'Selecciona el sexo' }),
  relationship: z.enum(['ESPOSO_A', 'HIJO_A', 'PADRE_MADRE', 'HERMANO_A', 'OTRO'], {
    message: 'Selecciona el parentesco',
  }),
  special_conditions: z
    .array(z.enum(['CHILD_UNDER_5', 'ELDERLY_OVER_65', 'PREGNANT', 'DISABLED']))
    .default([]),
  requires_medication: z.boolean().default(false),
})

export type PersonFormValues = z.infer<typeof personSchema>
