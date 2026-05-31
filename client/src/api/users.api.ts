import { api } from './axios'
import type { ApiItem, ApiList } from '@/types/api.types'
import type {
  AdminUser,
  RegisterUserPayload,
  ResetPasswordResult,
  UpdateUserPayload,
  UsersListParams,
} from '@/types/user.types'

// Los endpoints de gestión de usuarios viven en el módulo AUTH (solo ADMIN).
// El backend envuelve todo en { success, data } (+ pagination en el listado),
// así que desempaquetamos con r.data.data salvo en list() que necesita pagination.
export const usersApi = {
  // Listado paginado para la página de Usuarios.
  list(params: UsersListParams) {
    return api
      .get<ApiList<AdminUser>>('/auth/users', { params: { page: params.page, limit: params.limit } })
      .then((r) => r.data)
  },

  // Crear usuario (genera/recibe una contraseña que el admin entrega al usuario).
  register(payload: RegisterUserPayload) {
    return api.post<ApiItem<AdminUser>>('/auth/register', payload).then((r) => r.data.data)
  },

  // Editar rol / estado / nombre.
  update(id: number, payload: UpdateUserPayload) {
    return api.put<ApiItem<AdminUser>>(`/auth/users/${id}`, payload).then((r) => r.data.data)
  },

  // Resetear contraseña: el backend genera una temporal y la devuelve una sola vez.
  resetPassword(userId: number, newPassword?: string) {
    const body = newPassword ? { new_password: newPassword } : {}
    return api
      .post<ApiItem<ResetPasswordResult>>(`/auth/reset-password/${userId}`, body)
      .then((r) => r.data.data)
  },
}
