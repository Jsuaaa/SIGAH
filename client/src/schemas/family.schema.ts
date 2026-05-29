import { z } from 'zod'

// Campos núcleo de la familia, editables tanto al crear como al actualizar.
// La ubicación (lat/lng) es opcional para familias y se maneja aparte (MapPicker).
const coreShape = {
  head_document: z
    .string()
    .trim()
    .min(5, 'Mínimo 5 caracteres')
    .max(30, 'Máximo 30 caracteres'),
  zone_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Selecciona la zona' }).int().min(1, 'Selecciona la zona'),
  ),
  shelter_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).nullable(),
  ),
  status: z.enum(['ACTIVO', 'EN_REFUGIO', 'EVACUADO'], {
    message: 'Selecciona el estado',
  }),
  reference_address: z.string().trim().max(250, 'Máximo 250 caracteres').optional(),
}

// Conteos de composición (solo en el alta; en edición se derivan de las personas).
// Cada conteo no puede superar el total de miembros.
const compositionShape = {
  num_members: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ message: 'Ingresa el número de integrantes' }).int('Debe ser un entero').min(1, 'Al menos 1'),
  ),
  num_children_under_5: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  ),
  num_adults_over_65: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  ),
  num_pregnant: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  ),
  num_disabled: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  ),
}

export const familyEditSchema = z.object(coreShape)

// Alta: núcleo + composición + consentimiento obligatorio (RN-09).
export const familyCreateSchema = z
  .object({
    ...coreShape,
    ...compositionShape,
    privacy_consent_accepted: z.boolean(),
  })
  .refine((d) => d.num_children_under_5 <= d.num_members, {
    path: ['num_children_under_5'],
    message: 'No puede superar el total de integrantes',
  })
  .refine((d) => d.num_adults_over_65 <= d.num_members, {
    path: ['num_adults_over_65'],
    message: 'No puede superar el total de integrantes',
  })
  .refine((d) => d.num_pregnant <= d.num_members, {
    path: ['num_pregnant'],
    message: 'No puede superar el total de integrantes',
  })
  .refine((d) => d.num_disabled <= d.num_members, {
    path: ['num_disabled'],
    message: 'No puede superar el total de integrantes',
  })
  .refine((d) => d.privacy_consent_accepted === true, {
    path: ['privacy_consent_accepted'],
    message: 'Debe aceptar el aviso de privacidad (Ley 1581/2012) para registrar la familia',
  })

export type FamilyCreateValues = z.infer<typeof familyCreateSchema>
export type FamilyEditValues = z.infer<typeof familyEditSchema>
