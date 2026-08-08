import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { usersApi } from '../api/users.api'
import type { ChangeUserStatusDto, User } from '../types/user.types'

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()

  return useMutation<User, AxiosError, { id: string; dto: ChangeUserStatusDto }>({
    mutationFn: ({ id, dto }) => usersApi.updateUserStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}