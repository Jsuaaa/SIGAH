import { z } from 'zod'

// Los 6 roles del sistema (RF-01). Se mantienen como literal para el enum de Zod.
const ROLES = [
  'ADMIN',
  'CENSADOR',
  'OPERADOR_ENTREGAS',
  'COORDINADOR_LOGISTICA',
  'FUNCIONARIO_CONTROL',
  'REGISTRADOR_DONACIONES',
] as const

// Registro de usuario (HU-01). El backend exige password de mínimo 8 caracteres;
// el formulario ofrece generar una temporal, pero igual la validamos aquí.
export const userRegisterSchema = z.object({
  email: z.string().trim().email('Correo electrónico inválido'),
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  role: z.enum(ROLES, { message: 'Selecciona un rol válido' }),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type UserRegisterValues = z.infer<typeof userRegisterSchema>

// Edición de usuario (rol / estado / nombre).
export const userUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  role: z.enum(ROLES, { message: 'Selecciona un rol válido' }),
  is_active: z.boolean(),
})

export type UserUpdateValues = z.infer<typeof userUpdateSchema>
