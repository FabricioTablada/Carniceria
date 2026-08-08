import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { rolesApi } from '../api/roles.api'
import type { Role } from '../types/role.types'

export function useRole(id: string) {
  return useQuery<Role, AxiosError>({
    queryKey: ['roles', 'detail', id],
    queryFn: () => rolesApi.getRoleById(id),
    enabled: Boolean(id),
  })
}