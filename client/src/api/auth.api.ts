import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { LoginPayload, LoginResponse, User } from '@/types/auth.types'

// Modulo de API de Auth. Patron a replicar en el resto de modulos
// (families.api.ts, deliveries.api.ts, ...). Endpoints reales: /api/v1/auth/*.
// El backend envuelve todo en { success, data }, asi que desempaquetamos
// con r.data.data igual que zones/shelters/families.
export const authApi = {
  login(payload: LoginPayload) {
    return api.post<ApiItem<LoginResponse>>('/auth/login', payload).then((r) => r.data.data)
  },
  me() {
    return api.get<ApiItem<User>>('/auth/me').then((r) => r.data.data)
  },
  changePassword(payload: { oldPassword: string; newPassword: string }) {
    return api.put('/auth/change-password', payload).then((r) => r.data)
  },
}
