import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { usersApi } from '@/api/users.api'
import type { RegisterUserPayload, UpdateUserPayload, UsersListParams } from '@/types/user.types'

// Listado paginado de usuarios (solo ADMIN).
export function useUsersList(params: Ref<UsersListParams>) {
  return useQuery({
    queryKey: ['users', 'list', params],
    queryFn: () => usersApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

// Mutaciones de usuario: al terminar invalidan todo lo de usuarios.
export function useUserMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const register = useMutation({
    mutationFn: (payload: RegisterUserPayload) => usersApi.register(payload),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      usersApi.update(id, payload),
    onSuccess: invalidate,
  })
  const resetPassword = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword?: string }) =>
      usersApi.resetPassword(userId, newPassword),
    onSuccess: invalidate,
  })

  return { register, update, resetPassword }
}
