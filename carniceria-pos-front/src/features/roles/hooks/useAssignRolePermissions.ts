import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { rolesApi } from '../api/roles.api'
import type { AssignRolePermissionsDto, Role } from '../types/role.types'

export function useAssignRolePermissions() {
  const queryClient = useQueryClient()

  return useMutation<Role, AxiosError, { id: string; dto: AssignRolePermissionsDto }>({
    mutationFn: ({ id, dto }) => rolesApi.assignRolePermissions(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}