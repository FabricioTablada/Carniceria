import { httpClient } from '@/lib/htpp/client'
import type { LoginRequest, LoginResponse } from '../types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

interface RefreshResponse {
  accessToken: string
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await httpClient.post<ApiEnvelope<LoginResponse>>(
      '/auth/login',
      credentials,
    )

    return data.data
  },

  // El refreshToken viaja como cookie httpOnly (A-01) — httpClient ya usa
  // withCredentials: true, por lo que la cookie se envia automaticamente,
  // sin que este archivo (ni ningun otro del frontend) la lea o la
  // manipule.
  refresh: async (): Promise<RefreshResponse> => {
    const { data } = await httpClient.post<ApiEnvelope<RefreshResponse>>('/auth/refresh')

    return data.data
  },

  logout: async (): Promise<void> => {
    await httpClient.post('/auth/logout')
  },

  // Bloque 7.24 (pantalla de bloqueo por inactividad): verifica la
  // contrasena del usuario YA autenticado — nunca emite ni rota tokens,
  // por eso no hay envelope con `accessToken` que devolver, a diferencia
  // de `login`. El backend responde 204 si coincide, 401 si no.
  verifyPassword: async (password: string): Promise<void> => {
    await httpClient.post('/auth/verify-password', { password })
  },
}