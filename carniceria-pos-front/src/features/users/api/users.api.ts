import { httpClient } from '@/lib/htpp/client'
import type {
  ChangeUserStatusDto,
  CreateUserDto,
  PaginatedUsersResponse,
  UpdateUserDto,
  User,
  UserFilters,
} from '../types/user.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const usersApi = {
  getUsers: async (filters?: UserFilters): Promise<PaginatedUsersResponse> => {
    const { data } = await httpClient.get<PaginatedUsersResponse>('/users', {
      params: filters,
    })

    return data
  },

  getUserById: async (id: string): Promise<User> => {
    const { data } = await httpClient.get<ApiEnvelope<User>>(`/users/${id}`)

    return data.data
  },

  // GET /users/me: perfil del usuario autenticado, resuelto por el
  // backend desde req.user (JWT) — no recibe ningun id. Es la unica via
  // legitima para que el frontend conozca el `sucursalId` del usuario
  // logueado (POST /auth/login no lo devuelve, ver features/auth/types.ts).
  getMe: async (): Promise<User> => {
    const { data } = await httpClient.get<ApiEnvelope<User>>('/users/me')

    return data.data
  },

  createUser: async (data: CreateUserDto): Promise<User> => {
    const { data: response } = await httpClient.post<ApiEnvelope<User>>(
      '/users',
      data,
    )

    return response.data
  },

  updateUser: async (id: string, data: UpdateUserDto): Promise<User> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<User>>(
      `/users/${id}`,
      data,
    )

    return response.data
  },

  updateUserStatus: async (
    id: string,
    data: ChangeUserStatusDto,
  ): Promise<User> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<User>>(
      `/users/${id}/status`,
      data,
    )

    return response.data
  },
}