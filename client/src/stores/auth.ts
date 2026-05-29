import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TOKEN_KEY } from '@/api/axios'
import { authApi } from '@/api/auth.api'
import type { LoginPayload, Role, User } from '@/types/auth.types'

// Store de autenticacion (reemplaza el AuthContext de React).
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const mustChangePassword = computed(() => user.value?.password_must_change === true)

  function setSession(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(TOKEN_KEY, newToken)
  }

  // Login: el backend devuelve solo el token; el perfil (rol, password_must_change)
  // se obtiene con /auth/me. Devuelve el usuario cargado (o null si falla /me).
  async function login(payload: LoginPayload) {
    const { token: newToken } = await authApi.login(payload)
    token.value = newToken
    localStorage.setItem(TOKEN_KEY, newToken)
    return await fetchMe()
  }

  async function fetchMe() {
    if (!token.value) return null
    user.value = await authApi.me()
    return user.value
  }

  // Cambio de contraseña propio (HU-03). Tras el cambio el backend pone
  // password_must_change=false; recargamos el perfil para reflejarlo.
  async function changePassword(oldPassword: string, newPassword: string) {
    await authApi.changePassword({ oldPassword, newPassword })
    await fetchMe()
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  function hasRole(...roles: Role[]) {
    return !!user.value && roles.includes(user.value.role)
  }

  return {
    token,
    user,
    isAuthenticated,
    mustChangePassword,
    setSession,
    login,
    fetchMe,
    changePassword,
    logout,
    hasRole,
  }
})
