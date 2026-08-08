import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { rolesApi } from '../api/roles.api'
import type { ChangeRoleStatusDto, Role } from '../types/role.types'

export function useUpdateRoleStatus() {
  const queryClient = useQueryClient()

  return useMutation<Role, AxiosError, { id: string; dto: ChangeRoleStatusDto }>({
    mutationFn: ({ id, dto }) => rolesApi.updateRoleStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}