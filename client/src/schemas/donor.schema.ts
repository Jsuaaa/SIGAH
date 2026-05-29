import { z } from 'zod'

// Formulario de donante (HU-18). El contacto es obligatorio (CA2). La unicidad
// (name, type) la valida el backend (409, CA3).
export const donorSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  type: z.enum(['PERSONA_NATURAL', 'EMPRESA', 'ALCALDIA', 'GOBERNACION', 'ORGANIZACION'], {
    message: 'Selecciona el tipo de donante',
  }),
  contact: z.string().trim().min(3, 'El contacto es obligatorio (mín. 3 caracteres)').max(200, 'Máximo 200 caracteres'),
  tax_id: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
})

export type DonorFormValues = z.infer<typeof donorSchema>
