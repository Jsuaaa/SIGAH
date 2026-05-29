// Los 6 roles finales del sistema (ver PLAN.md / FRONTEND-PLAN.md §7).
export type Role =
  | 'ADMIN'
  | 'CENSADOR'
  | 'OPERADOR_ENTREGAS'
  | 'COORDINADOR_LOGISTICA'
  | 'FUNCIONARIO_CONTROL'
  | 'REGISTRADOR_DONACIONES'

// Perfil devuelto por GET /auth/me (briefUserView del backend).
export interface User {
  id: number
  email: string
  name: string
  role: Role
  is_active: boolean
  password_must_change: boolean
  created_at?: string
  updated_at?: string
  last_login_at?: string | null
}

export interface LoginPayload {
  email: string
  password: string
}

// POST /auth/login devuelve SOLO el token (sin user). El perfil se obtiene
// luego con GET /auth/me. (Confirmado en server/src/services/auth.service.ts.)
export interface LoginResponse {
  token: string
}
