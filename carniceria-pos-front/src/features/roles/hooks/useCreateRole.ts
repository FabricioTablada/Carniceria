import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { rolesApi } from '../api/roles.api'
import type { CreateRoleDto, Role } from '../types/role.types'

export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation<Role, AxiosError, CreateRoleDto>({
    mutationFn: (dto) => rolesApi.createRole(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}