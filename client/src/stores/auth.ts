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

  async function login(payload: LoginPayload) {
    const res = await authApi.login(payload)
    setSession(res.token, res.user)
    return res.user
  }

  async function fetchMe() {
    if (!token.value) return null
    user.value = await authApi.me()
    return user.value
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
    logout,
    hasRole,
  }
})
