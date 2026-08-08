import type { Permission } from '@/constants/permissions'

export interface User {
  id: string
  username: string
  fullName: string
  role: string
  permissions?: Permission[]
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  accessToken: string
}