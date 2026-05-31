import { z } from 'zod'
import { MIN_COVERAGE_DAYS } from '@/utils/constants'

// Validación Zod-en-submit del formulario de entregas (HU-22/HU-23). Refleja las reglas del
// backend (createDeliveryRules / createExceptionRules):
//   - coverage_days entero >= 3 (RN-01).
//   - al menos un renglón con resource_type_id + quantity (>0).
//   - exception_reason 5-1000 caracteres en el caso de excepción (HU-23 CA5).
// Los campos de coordenadas y received_by_document son opcionales.

const itemSchema = z.object({
  resource_type_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
})

// Base compartida por la entrega regular y la excepción.
export const deliverySchema = z.object({
  family_id: z.coerce.number().int().positive(),
  source_warehouse_id: z.coerce.number().int().positive(),
  coverage_days: z.coerce.number().int().min(MIN_COVERAGE_DAYS),
  received_by_document: z.string().trim().max(30).optional().nullable(),
  delivery_latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  delivery_longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemSchema).min(1),
})

// Excepción: añade la justificación obligatoria (HU-23 CA5).
export const deliveryExceptionSchema = deliverySchema.extend({
  exception_reason: z.string().trim().min(5).max(1000),
})

// Lote: top N familias priorizadas (1-100, batchRules).
export const deliveryBatchSchema = z.object({
  count: z.coerce.number().int().min(1).max(100),
})

export type DeliveryFormValues = z.infer<typeof deliverySchema>
export type DeliveryExceptionFormValues = z.infer<typeof deliveryExceptionSchema>
export type DeliveryBatchFormValues = z.infer<typeof deliveryBatchSchema>
