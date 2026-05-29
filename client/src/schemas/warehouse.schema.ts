import { z } from 'zod'

// Campos del formulario de bodega. La ubicación (lat/lng) se valida aparte en la
// página: es obligatoria (RN-10, HU-11 CA2).
export const warehouseSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  address: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  zone_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Selecciona la zona' }).int().min(1, 'Selecciona la zona'),
  ),
  max_capacity_kg: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Ingresa la capacidad' }).positive('Debe ser mayor que 0'),
  ),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

export type WarehouseFormValues = z.infer<typeof warehouseSchema>
