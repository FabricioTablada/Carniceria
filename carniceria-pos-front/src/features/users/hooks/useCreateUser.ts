import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { usersApi } from '../api/users.api'
import type { CreateUserDto, User } from '../types/user.types'

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation<User, AxiosError, CreateUserDto>({
    mutationFn: (dto) => usersApi.createUser(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}