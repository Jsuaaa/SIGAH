import { z } from 'zod';

export const familyCreateSchema = z.object({
  head_document: z
    .string()
    .trim()
    .min(5, 'El documento debe tener al menos 5 caracteres')
    .max(30, 'El documento no puede superar 30 caracteres'),
  zone_id: z.coerce.number().int().positive('La zona es obligatoria'),
  shelter_id: z
    .coerce.number()
    .int()
    .positive()
    .optional()
    .nullable(),
  num_members: z.coerce
    .number()
    .int('El número de integrantes debe ser entero')
    .min(1, 'Debe haber al menos 1 integrante'),
  num_children_under_5: z.coerce
    .number()
    .int()
    .min(0, 'No puede ser negativo')
    .default(0),
  num_adults_over_65: z.coerce
    .number()
    .int()
    .min(0, 'No puede ser negativo')
    .default(0),
  num_pregnant: z.coerce
    .number()
    .int()
    .min(0, 'No puede ser negativo')
    .default(0),
  num_disabled: z.coerce
    .number()
    .int()
    .min(0, 'No puede ser negativo')
    .default(0),
  status: z
    .enum(['ACTIVO', 'EN_REFUGIO', 'EVACUADO'])
    .default('ACTIVO'),
  latitude: z
    .coerce.number()
    .min(-90)
    .max(90)
    .optional()
    .nullable(),
  longitude: z
    .coerce.number()
    .min(-180)
    .max(180)
    .optional()
    .nullable(),
  reference_address: z
    .string()
    .trim()
    .max(250, 'La dirección no puede superar 250 caracteres')
    .optional()
    .nullable()
    .or(z.literal('')),
  privacy_consent_accepted: z.literal(true, {
    message: 'Debes aceptar el aviso de privacidad',
  }),
});

export type FamilyCreateInput = z.infer<typeof familyCreateSchema>;

// HU-07: edición de una familia ya registrada. Solo los campos que admite
// updateFamilyRules del backend (NO incluye num_members ni la composición ni el
// consentimiento: eso se deriva de las personas / se fija al crear).
export const familyUpdateSchema = z.object({
  head_document: z
    .string()
    .trim()
    .min(5, 'El documento debe tener al menos 5 caracteres')
    .max(30, 'El documento no puede superar 30 caracteres'),
  zone_id: z.coerce.number().int().positive('La zona es obligatoria'),
  shelter_id: z
    .coerce.number()
    .int()
    .positive()
    .optional()
    .nullable(),
  status: z.enum(['ACTIVO', 'EN_REFUGIO', 'EVACUADO']),
  latitude: z
    .coerce.number()
    .min(-90)
    .max(90)
    .optional()
    .nullable(),
  longitude: z
    .coerce.number()
    .min(-180)
    .max(180)
    .optional()
    .nullable(),
  reference_address: z
    .string()
    .trim()
    .max(250, 'La dirección no puede superar 250 caracteres')
    .optional()
    .nullable()
    .or(z.literal('')),
});

export type FamilyUpdateInput = z.infer<typeof familyUpdateSchema>;
