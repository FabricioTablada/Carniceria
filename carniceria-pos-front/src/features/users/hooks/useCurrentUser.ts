import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { usersApi } from '../api/users.api'
import type { User } from '../types/user.types'

export function useCurrentUser() {
  return useQuery<User, AxiosError>({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.getMe(),
  })
}