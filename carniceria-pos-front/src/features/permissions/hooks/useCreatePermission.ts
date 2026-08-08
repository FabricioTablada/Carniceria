import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { permissionsApi } from '../api/permissions.api'
import type {
  CreatePermissionDto,
  Permission,
} from '../types/permission.types'

export function useCreatePermission() {
  const queryClient = useQueryClient()

  return useMutation<Permission, AxiosError, CreatePermissionDto>({
    mutationFn: (dto) => permissionsApi.createPermission(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}