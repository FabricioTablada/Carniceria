import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { permissionsApi } from '../api/permissions.api'
import type {
  PaginatedPermissionsResponse,
  PermissionFilters,
} from '../types/permission.types'

export function usePermissions(filters?: PermissionFilters) {
  return useQuery<PaginatedPermissionsResponse, AxiosError>({
    queryKey: ['permissions', filters],
    queryFn: () => permissionsApi.getPermissions(filters),
  })
}