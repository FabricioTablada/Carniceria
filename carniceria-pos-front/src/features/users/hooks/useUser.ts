import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { usersApi } from '../api/users.api'
import type { User } from '../types/user.types'

export function useUser(id: string) {
  return useQuery<User, AxiosError>({
    queryKey: ['users', 'detail', id],
    queryFn: () => usersApi.getUserById(id),
    enabled: Boolean(id),
  })
}