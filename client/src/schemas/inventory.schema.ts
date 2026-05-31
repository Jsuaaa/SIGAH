import { z } from 'zod'

// HU-17: validación del ajuste de inventario. Espejo de adjustInventoryRules del
// backend (server/src/validators/inventory.validator.ts): reason es el enum en
// español del backend (adjustment_reason), reason_note 3-500 caracteres y la
// nueva cantidad debe ser un entero >= 0 (el backend recibe el delta resultante y
// rechaza stock negativo con SH422, HU-17 CA3). Zod v4.
//
// El formulario pide la *nueva cantidad* (más claro para el usuario que un delta
// crudo); la página calcula delta = new_quantity - cantidad_actual para el body.
export const inventoryAdjustSchema = z.object({
  // Coerción manual: '' / null / undefined -> undefined para mostrar el mensaje de
  // requerido en lugar de "NaN". Cualquier otro valor se pasa a Number().
  new_quantity: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ message: 'La cantidad es obligatoria' })
      .int('La cantidad debe ser un número entero')
      .min(0, 'La cantidad no puede ser negativa'),
  ),
  reason: z.enum(['MERMA', 'DANO', 'DEVOLUCION', 'CORRECCION'], {
    message: 'Selecciona un motivo válido',
  }),
  reason_note: z
    .string()
    .trim()
    .min(3, 'La nota debe tener al menos 3 caracteres')
    .max(500, 'La nota no puede superar 500 caracteres'),
})

export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>
