import type { Role } from './auth.types'
import { ROLE_LABELS } from '@/utils/constants'

// Orden de roles para selects/etiquetas. Reusa ROLE_LABELS de utils/constants
// (única fuente de verdad de los nombres en español).
const ALL_ROLES: Role[] = [
  'ADMIN',
  'CENSADOR',
  'OPERADOR_ENTREGAS',
  'COORDINADOR_LOGISTICA',
  'FUNCIONARIO_CONTROL',
  'REGISTRADOR_DONACIONES',
]

export const ROLE_OPTIONS: { value: Role; label: string }[] = ALL_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}))

// Fila de GET /auth/users (fn_users_list: User sin password_hash).
export interface UserListItem {
  id: number
  email: string
  name: string
  role: Role
  is_active: boolean
  password_must_change: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// GET /auth/users responde plano: { success, data, total, page, per_page }
// (NO el envelope { data, pagination } del resto de módulos).
export interface UsersListResponse {
  success: boolean
  data: UserListItem[]
  total: number
  page: number
  per_page: number
}

export interface UsersListParams {
  page: number
  per_page: number
  role?: Role
  is_active?: boolean
}

// POST /auth/register (solo ADMIN). El backend marca password_must_change=true.
export interface RegisterUserPayload {
  email: string
  password: string
  name: string
  role: Role
}

// POST /auth/reset-password/:userId → contraseña temporal generada (se muestra
// una sola vez al ADMIN).
export interface ResetPasswordResult {
  temporary_password: string
}
