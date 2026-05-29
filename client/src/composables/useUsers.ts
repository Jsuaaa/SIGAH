import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { authApi } from '@/api/auth.api'
import type { RegisterUserPayload, UsersListParams } from '@/types/user.types'

// Listado paginado de usuarios (solo ADMIN). Refetch al cambiar filtros/página.
export function useUsersList(params: Ref<UsersListParams>) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => authApi.listUsers(params.value),
    placeholderData: keepPreviousData,
  })
}

// Mutaciones de gestión de usuarios. resetPassword devuelve la contraseña
// temporal generada (se muestra una sola vez en la UI).
export function useUserMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const register = useMutation({
    mutationFn: (payload: RegisterUserPayload) => authApi.register(payload),
    onSuccess: invalidate,
  })
  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => authApi.setActive(id, isActive),
    onSuccess: invalidate,
  })
  const resetPassword = useMutation({
    mutationFn: (userId: number) => authApi.resetPassword(userId),
    onSuccess: invalidate,
  })

  return { register, setActive, resetPassword }
}
