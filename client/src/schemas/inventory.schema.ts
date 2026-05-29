import { z } from 'zod'

// Agregar stock a una bodega (upsert por lote). quantity es entero > 0.
export const upsertInventorySchema = z.object({
  resource_type_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Selecciona el recurso' }).int().min(1, 'Selecciona el recurso'),
  ),
  quantity: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Ingresa la cantidad' }).int('Debe ser un entero').positive('Debe ser mayor que 0'),
  ),
  batch: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  expiration_date: z.string().optional(),
})

export type UpsertInventoryValues = z.infer<typeof upsertInventorySchema>

// Ajuste manual de existencias (HU-17): delta entero distinto de cero + motivo + nota.
export const adjustmentSchema = z.object({
  delta: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ message: 'Ingresa la cantidad a ajustar' })
      .int('Debe ser un entero')
      .refine((n) => n !== 0, 'No puede ser cero'),
  ),
  reason: z.enum(['MERMA', 'DANO', 'DEVOLUCION', 'CORRECCION'], { message: 'Selecciona el motivo' }),
  reason_note: z.string().trim().min(3, 'Mínimo 3 caracteres').max(500, 'Máximo 500 caracteres'),
})

export type AdjustmentValues = z.infer<typeof adjustmentSchema>
