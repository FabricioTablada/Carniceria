import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { permissionsApi } from '../api/permissions.api'
import type {
  Permission,
  UpdatePermissionDto,
} from '../types/permission.types'

export function useUpdatePermission() {
  const queryClient = useQueryClient()

  return useMutation<Permission, AxiosError, { id: string; dto: UpdatePermissionDto }>({
    mutationFn: ({ id, dto }) => permissionsApi.updatePermission(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}