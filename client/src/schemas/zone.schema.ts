import { z } from 'zod'

// Campos textuales/numéricos del formulario de zona. La ubicación (lat/lng) se
// valida aparte en la página porque proviene del MapPicker (RN-10).
export const zoneSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    message: 'Selecciona el nivel de riesgo',
  }),
  estimated_population: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ message: 'Ingresa la población estimada' })
      .int('Debe ser un número entero')
      .min(0, 'No puede ser negativo'),
  ),
})

export type ZoneFormValues = z.infer<typeof zoneSchema>
