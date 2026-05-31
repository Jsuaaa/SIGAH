import { z } from 'zod';
import { DONOR_TYPE_OPTIONS, type DonorType } from '@/types/donor.types';

const DONOR_TYPE_VALUES = DONOR_TYPE_OPTIONS.map((o) => o.value) as [
  DonorType,
  ...DonorType[],
];

// Patrones de contacto: correo electrónico O teléfono. HU-18 CA2: contact es
// obligatorio y debe ser un medio de contacto válido. El backend solo valida
// longitud (3–200), así que aquí reforzamos el formato del lado cliente.
const EMAIL_REGEX = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

// Espejo de server/src/validators/donors.validator.ts. Validación en submit.
//   name    : 2–200 caracteres.
//   type    : enum donor_type.
//   contact : 3–200 caracteres, teléfono o correo válido (HU-18 CA2).
//   tax_id  : opcional, máx. 30 caracteres.
export const donorSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  type: z.enum(DONOR_TYPE_VALUES, { message: 'Selecciona el tipo de donante' }),
  contact: z
    .string()
    .trim()
    .min(3, 'El contacto es obligatorio')
    .max(200, 'Máximo 200 caracteres')
    .refine((val) => EMAIL_REGEX.test(val) || PHONE_REGEX.test(val), {
      message: 'Ingresa un teléfono o correo electrónico válido',
    }),
  tax_id: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
});

export type DonorFormValues = z.infer<typeof donorSchema>;
