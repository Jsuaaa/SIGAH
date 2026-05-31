import { z } from 'zod'

// Validación del formulario de integrante (HU-05). Mensajes en español, Zod en
// submit. birth_date llega como string del input date (YYYY-MM-DD).
export const personCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(120, 'El nombre no puede superar 120 caracteres'),
  document: z
    .string()
    .trim()
    .min(5, 'El documento debe tener al menos 5 caracteres')
    .max(30, 'El documento no puede superar 30 caracteres'),
  birth_date: z
    .string()
    .trim()
    .min(1, 'La fecha de nacimiento es obligatoria')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida')
    .refine((v) => {
      const d = new Date(v)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return d <= today
    }, 'La fecha no puede ser futura'),
  gender: z.enum(['M', 'F', 'OTRO'], { message: 'Selecciona el género' }),
  relationship: z.enum(['ESPOSO_A', 'HIJO_A', 'PADRE_MADRE', 'HERMANO_A', 'OTRO'], {
    message: 'Selecciona el parentesco',
  }),
  special_conditions: z
    .array(z.enum(['CHILD_UNDER_5', 'ELDERLY_OVER_65', 'PREGNANT', 'DISABLED']))
    .default([]),
  requires_medication: z.boolean().default(false),
})

export type PersonCreateInput = z.infer<typeof personCreateSchema>
