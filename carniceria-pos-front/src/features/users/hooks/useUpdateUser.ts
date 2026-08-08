import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { usersApi } from '../api/users.api'
import type { UpdateUserDto, User } from '../types/user.types'

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation<User, AxiosError, { id: string; dto: UpdateUserDto }>({
    mutationFn: ({ id, dto }) => usersApi.updateUser(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}