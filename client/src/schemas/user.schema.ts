import { z } from 'zod'

// Formulario de registro de usuario (solo ADMIN, HU-01). Refleja POST /auth/register.
export const registerUserSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña temporal debe tener al menos 8 caracteres'),
  role: z.enum(
    ['ADMIN', 'CENSADOR', 'OPERADOR_ENTREGAS', 'COORDINADOR_LOGISTICA', 'FUNCIONARIO_CONTROL', 'REGISTRADOR_DONACIONES'],
    { message: 'Selecciona el rol' },
  ),
})

export type RegisterUserValues = z.infer<typeof registerUserSchema>
