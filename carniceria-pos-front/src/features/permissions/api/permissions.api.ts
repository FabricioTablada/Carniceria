import { httpClient } from '@/lib/htpp/client'
import type {
  CreatePermissionDto,
  PaginatedPermissionsResponse,
  Permission,
  PermissionFilters,
  UpdatePermissionDto,
} from '../types/permission.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const permissionsApi = {
  getPermissions: async (
    filters?: PermissionFilters,
  ): Promise<PaginatedPermissionsResponse> => {
    const { data } = await httpClient.get<PaginatedPermissionsResponse>(
      '/permissions',
      { params: filters },
    )

    return data
  },

  getPermissionById: async (id: string): Promise<Permission> => {
    const { data } = await httpClient.get<ApiEnvelope<Permission>>(
      `/permissions/${id}`,
    )

    return data.data
  },

  createPermission: async (
    data: CreatePermissionDto,
  ): Promise<Permission> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Permission>>(
      '/permissions',
      data,
    )

    return response.data
  },

  updatePermission: async (
    id: string,
    data: UpdatePermissionDto,
  ): Promise<Permission> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Permission>>(
      `/permissions/${id}`,
      data,
    )

    return response.data
  },
}