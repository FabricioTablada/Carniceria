import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { rolesApi } from '../api/roles.api'
import type { PaginatedRolesResponse, RoleFilters } from '../types/role.types'

export function useRoles(filters?: RoleFilters) {
  return useQuery<PaginatedRolesResponse, AxiosError>({
    queryKey: ['roles', 'list', filters],
    queryFn: () => rolesApi.getRoles(filters),
  })
}