import type { Role } from '@/types/auth.types'

// Usuario tal como lo devuelve GET /auth/users (PublicUser = User sin password_hash).
// Las fechas llegan como ISO string desde el backend (pg → JSON).
export interface AdminUser {
  id: number
  email: string
  name: string
  role: Role
  is_active: boolean
  failed_login_attempts: number
  locked_until: string | null
  last_login_at: string | null
  password_must_change: boolean
  created_at: string
  updated_at?: string
}

export interface UsersListParams {
  page: number
  limit: number
}

// POST /auth/register — el backend exige password (min 8) y name; devuelve el
// usuario creado (BriefUser) con password_must_change=true.
export interface RegisterUserPayload {
  email: string
  name: string
  role: Role
  password: string
}

// PUT /auth/users/:id — campos opcionales (rol, estado, nombre).
export interface UpdateUserPayload {
  role?: Role
  is_active?: boolean
  name?: string
}

// POST /auth/reset-password/:userId → data: { temporary_password }.
export interface ResetPasswordResult {
  temporary_password: string
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  CENSADOR: 'Censador',
  OPERADOR_ENTREGAS: 'Operador de entregas',
  COORDINADOR_LOGISTICA: 'Coordinador de logística',
  FUNCIONARIO_CONTROL: 'Funcionario de control',
  REGISTRADOR_DONACIONES: 'Registrador de donaciones',
}

export const ROLE_OPTIONS: { value: Role; label: string }[] = (
  Object.keys(ROLE_LABELS) as Role[]
).map((value) => ({ value, label: ROLE_LABELS[value] }))
