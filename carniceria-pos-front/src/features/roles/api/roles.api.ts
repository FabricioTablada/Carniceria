import { httpClient } from '@/lib/htpp/client'
import type {
  AssignRolePermissionsDto,
  ChangeRoleStatusDto,
  CreateRoleDto,
  PaginatedRolesResponse,
  Role,
  RoleFilters,
  UpdateRoleDto,
} from '../types/role.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const rolesApi = {
  getRoles: async (
    filters?: RoleFilters,
  ): Promise<PaginatedRolesResponse> => {
    const { data } = await httpClient.get<PaginatedRolesResponse>('/roles', {
      params: filters,
    })

    return data
  },

  getRoleById: async (id: string): Promise<Role> => {
    const { data } = await httpClient.get<ApiEnvelope<Role>>(`/roles/${id}`)

    return data.data
  },

  createRole: async (data: CreateRoleDto): Promise<Role> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Role>>(
      '/roles',
      data,
    )

    return response.data
  },

  updateRole: async (
    id: string,
    data: UpdateRoleDto,
  ): Promise<Role> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Role>>(
      `/roles/${id}`,
      data,
    )

    return response.data
  },

  updateRoleStatus: async (
    id: string,
    data: ChangeRoleStatusDto,
  ): Promise<Role> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Role>>(
      `/roles/${id}/status`,
      data,
    )

    return response.data
  },

  assignRolePermissions: async (
    id: string,
    data: AssignRolePermissionsDto,
  ): Promise<Role> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Role>>(
      `/roles/${id}/permissions`,
      data,
    )

    return response.data
  },
}