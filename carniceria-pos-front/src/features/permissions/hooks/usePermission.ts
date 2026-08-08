import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { permissionsApi } from '../api/permissions.api'
import type { Permission } from '../types/permission.types'

export function usePermission(id: string) {
  return useQuery<Permission, AxiosError>({
    queryKey: ['permissions', id],
    queryFn: () => permissionsApi.getPermissionById(id),
    enabled: !!id,
  })
}