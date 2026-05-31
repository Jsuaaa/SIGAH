import { z } from 'zod'

// Validación del umbral mínimo de stock (HU-16 CA2). Coincide con
// server/src/validators/alerts.validator.ts (setThresholdRules): entero >= 0.
// El input llega como string desde el formulario y se coerciona aquí.
export const alertThresholdSchema = z.object({
  min_quantity: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z
      .number({ message: 'Ingresa una cantidad válida' })
      .int('Debe ser un número entero')
      .min(0, 'Debe ser ≥ 0'),
  ),
})
