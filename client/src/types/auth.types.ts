// Los 6 roles finales del sistema (ver PLAN.md / FRONTEND-PLAN.md §7).
export type Role =
  | 'ADMIN'
  | 'CENSADOR'
  | 'OPERADOR_ENTREGAS'
  | 'COORDINADOR_LOGISTICA'
  | 'FUNCIONARIO_CONTROL'
  | 'REGISTRADOR_DONACIONES'

export interface User {
  id: number
  email: string
  name: string
  role: Role
  is_active: boolean
  password_must_change: boolean
  last_login_at?: string | null
}

export interface LoginPayload {
  email: string
  password: string
}

// NOTA: ajustar a la forma real de POST /auth/login cuando se integre.
export interface LoginResponse {
  token: string
  user: User
}
