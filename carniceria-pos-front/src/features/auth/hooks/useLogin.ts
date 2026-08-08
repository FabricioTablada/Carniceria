import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '@/stores/authStore'
import { getDefaultRoute } from '@/constants/navigation'
import { PERMISSIONS } from '@/constants/permissions'
import type { LoginRequest, LoginResponse } from '../types'

interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 401) {
      return 'Usuario o contraseña incorrectos'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor'
    }
  }

  return 'Ocurrió un error al iniciar sesión. Intenta de nuevo.'
}

export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation<LoginResponse, AxiosError, LoginRequest>({
    mutationFn: (credentials) => authApi.login(credentials),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken)

      // Bloque 7.32: la primera pantalla tras iniciar sesión pasa a ser
      // Caja (`/cash-session/open`) en vez del Dashboard — el flujo
      // principal del día a día es abrir la caja/ir al POS. Solo cambia
      // ESTE punto de entrada (la navegación post-login); no se toca
      // `getDefaultRoute`/`DashboardRoute.tsx` (el gate de permiso de "/"
      // sigue exactamente igual), así que el Dashboard sigue
      // completamente accesible desde el menú lateral sin ningún cambio
      // de permisos/protección de rutas. Se conserva `getDefaultRoute`
      // como respaldo para el caso (hoy no real, pero ya soportado por el
      // tipo de permisos) de un usuario sin `cash.open`.
      const permissions = data.user.permissions ?? []
      const initialRoute = permissions.includes(PERMISSIONS.CASH_OPEN)
        ? '/cash-session/open'
        : getDefaultRoute(permissions)

      navigate(initialRoute, { replace: true })
    },
  })
}
