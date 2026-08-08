import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { rolesApi } from '../api/roles.api'
import type { Role, UpdateRoleDto } from '../types/role.types'

export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation<Role, AxiosError, { id: string; dto: UpdateRoleDto }>({
    mutationFn: ({ id, dto }) => rolesApi.updateRole(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}