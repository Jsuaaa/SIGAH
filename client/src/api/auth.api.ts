import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { LoginPayload, LoginResponse, User } from '@/types/auth.types'
import type {
  RegisterUserPayload,
  ResetPasswordResult,
  UserListItem,
  UsersListParams,
  UsersListResponse,
} from '@/types/user.types'

// Módulo de API de Auth. Endpoints reales: /api/v1/auth/*. El backend envuelve
// las respuestas en { success, data } → desenvolvemos a .data.data como el resto
// de la app (familias, refugios…).
export const authApi = {
  // Login devuelve SOLO { token }; el perfil se obtiene con /auth/me.
  login(payload: LoginPayload) {
    return api.post<ApiItem<LoginResponse>>('/auth/login', payload).then((r) => r.data.data)
  },
  me() {
    return api.get<ApiItem<User>>('/auth/me').then((r) => r.data.data)
  },
  // El backend espera oldPassword / newPassword (auth.validator.ts).
  changePassword(payload: { oldPassword: string; newPassword: string }) {
    return api.put('/auth/change-password', payload).then((r) => r.data)
  },

  // --- Gestión de usuarios (solo ADMIN) ---------------------------------------

  // Respuesta plana { success, data, total, page, per_page }; param de tamaño es
  // per_page (no limit).
  listUsers(params: UsersListParams) {
    const query: Record<string, string | number> = { page: params.page, per_page: params.per_page }
    if (params.role) query.role = params.role
    if (params.is_active !== undefined) query.is_active = String(params.is_active)
    return api.get<UsersListResponse>('/auth/users', { params: query }).then((r) => r.data)
  },

  register(payload: RegisterUserPayload) {
    return api.post<ApiItem<UserListItem>>('/auth/register', payload).then((r) => r.data.data)
  },

  setActive(id: number, isActive: boolean) {
    return api
      .put<ApiItem<UserListItem>>(`/auth/users/${id}`, { is_active: isActive })
      .then((r) => r.data.data)
  },

  // Genera y devuelve una contraseña temporal (se muestra una sola vez).
  resetPassword(userId: number) {
    return api
      .post<ApiItem<ResetPasswordResult>>(`/auth/reset-password/${userId}`, {})
      .then((r) => r.data.data)
  },
}
