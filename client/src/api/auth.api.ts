import { api } from './axios'
import type { LoginPayload, LoginResponse, User } from '@/types/auth.types'

// Modulo de API de Auth. Patron a replicar en el resto de modulos
// (families.api.ts, deliveries.api.ts, ...). Endpoints reales: /api/v1/auth/*.
export const authApi = {
  login(payload: LoginPayload) {
    return api.post<LoginResponse>('/auth/login', payload).then((r) => r.data)
  },
  me() {
    return api.get<User>('/auth/me').then((r) => r.data)
  },
  changePassword(payload: { current_password: string; new_password: string }) {
    return api.put('/auth/change-password', payload).then((r) => r.data)
  },
}
