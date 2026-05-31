import { z } from 'zod'
import { RELOCATION_TYPE_OPTIONS, type RelocationType } from '@/types/relocation.types'

const RELOCATION_TYPE_VALUES = RELOCATION_TYPE_OPTIONS.map((o) => o.value) as [
  RelocationType,
  ...RelocationType[],
]

// Espejo de server/src/validators/relocations.validator.ts → applyRules.
// Validación en submit.
//   family_id              : entero positivo (seleccionado de la lista).
//   destination_shelter_id : entero positivo (refugio destino, distinto del origen).
//   type                   : enum relocation_type.
//   reason                 : 5–1000 caracteres (obligatorio).
//   notes                  : opcional, máx. 2000 caracteres.
export const relocationSchema = z.object({
  family_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Selecciona la familia a trasladar' }).int().min(1, 'Selecciona la familia a trasladar'),
  ),
  destination_shelter_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Selecciona el refugio destino' }).int().min(1, 'Selecciona el refugio destino'),
  ),
  type: z.enum(RELOCATION_TYPE_VALUES, { message: 'Selecciona el tipo de traslado' }),
  reason: z
    .string()
    .trim()
    .min(5, 'El motivo es obligatorio (mínimo 5 caracteres)')
    .max(1000, 'Máximo 1000 caracteres'),
  notes: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional(),
})

export type RelocationFormValues = z.infer<typeof relocationSchema>
