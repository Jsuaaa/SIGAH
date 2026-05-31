import { z } from 'zod'

// HU-03: cambio de contraseña propia. Espejo de changePasswordRules del backend
// (oldPassword requerido, newPassword min 8) + confirmación coincidente en cliente.
export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
