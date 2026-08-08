import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { usersApi } from '../api/users.api'
import type { PaginatedUsersResponse, UserFilters } from '../types/user.types'

export function useUsers(filters?: UserFilters) {
  return useQuery<PaginatedUsersResponse, AxiosError>({
    queryKey: ['users', 'list', filters],
    queryFn: () => usersApi.getUsers(filters),
  })
}