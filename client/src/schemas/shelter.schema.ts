import { z } from 'zod'

// Campos del formulario de refugio. La ubicación (lat/lng) se valida aparte en la
// página porque proviene del MapPicker y es obligatoria (RN-10, HU-10 CA5).
export const shelterSchema = z
  .object({
    name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
    address: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
    zone_id: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number({ message: 'Selecciona la zona' }).int().min(1, 'Selecciona la zona'),
    ),
    type: z.enum(['SCHOOL', 'CHURCH', 'COMMUNITY_CENTER', 'STADIUM', 'TENT', 'OTHER'], {
      message: 'Selecciona el tipo de refugio',
    }),
    max_capacity: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number({ message: 'Ingresa la capacidad' }).int('Debe ser un entero').min(1, 'Debe ser al menos 1'),
    ),
    current_occupancy: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
      z.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
    ),
  })
  .refine((d) => d.current_occupancy <= d.max_capacity, {
    path: ['current_occupancy'],
    message: 'La ocupación no puede superar la capacidad máxima',
  })

export type ShelterFormValues = z.infer<typeof shelterSchema>
