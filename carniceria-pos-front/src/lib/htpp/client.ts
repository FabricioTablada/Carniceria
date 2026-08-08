import axios from 'axios'
import { env } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { refreshAccessToken } from './refreshManager'
import { performLogout } from './logoutManager'

/**
 * La app de escritorio (Electron) administra su propio backend en un
 * puerto que solo se conoce en tiempo de ejecucion (nunca fijo, nunca
 * horneado en el build) — `VITE_API_URL` es una constante de build de
 * Vite, inutil para ese caso. `preload.ts` del repo de escritorio expone
 * `window.__DESKTOP_API_BASE_URL__` de forma sincrona antes de que este
 * modulo se ejecute; si no existe (build web normal, o el propio `vite
 * dev`), se usa `VITE_API_URL` como siempre. Mismo build para ambos
 * entornos, sin valores hardcodeados.
 */
declare global {
  interface Window {
    __DESKTOP_API_BASE_URL__?: string
  }
}

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__DESKTOP_API_BASE_URL__) {
    return window.__DESKTOP_API_BASE_URL__
  }
  return env.VITE_API_URL
}

export const httpClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

httpClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

/**
 * Estabilidad de sesion, Bloque 2: endpoints de autenticacion que NUNCA
 * deben disparar un intento de refresh-y-reintento ante su propio 401.
 * - `/auth/login`: un 401 aca es "credenciales invalidas" — renovar un
 *   token no arregla eso, y no hay ninguna sesion previa que renovar.
 * - `/auth/refresh`: esta ES la peticion que `refreshAccessToken()` ya
 *   dispara internamente (Bloque 1). Si intentaramos refrescar en
 *   respuesta a SU PROPIO 401, estariamos esperando la misma promesa
 *   `inFlightRefresh` que todavia esta resolviendose (la llamada que
 *   esta fallando ahora mismo) — un ciclo circular, no un reintento
 *   util. Cuando el refresh en si falla, quien lo invoco (mas abajo en
 *   este mismo archivo) ya se encarga de cerrar la sesion.
 */
const AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH = ['/auth/login', '/auth/refresh']

function isExcludedFromRefresh(url?: string): boolean {
  return Boolean(
    url && AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH.some((path) => url.includes(path)),
  )
}

/** Peticiones originales que YA se reintentaron una vez tras una
 * renovacion — un `WeakSet` keyed por la referencia del `config` evita
 * tener que aumentar los tipos de Axios con un campo custom (`_retry`),
 * y se limpia solo (no hay forma de "olvidar" liberarlo: al no haber mas
 * referencias al `config`, el recolector de basura se encarga). Se usa
 * para garantizar que cada peticion se reintente COMO MAXIMO una vez —
 * la proteccion real contra bucles infinitos. */
const retriedRequests = new WeakSet<object>()

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    if (isExcludedFromRefresh(originalRequest.url)) {
      return Promise.reject(error)
    }

    if (retriedRequests.has(originalRequest)) {
      // Ya se intento renovar y reintentar esta peticion una vez (o el
      // reintento volvio a fallar con 401) — no se reintenta una
      // segunda vez. Un 401 que persiste incluso despues de una
      // renovacion exitosa equivale, para el usuario, a "no
      // autenticado": se cierra la sesion (Bloque 3: mismo flujo de
      // limpieza que el logout manual, via `performLogout()`).
      await performLogout()
      return Promise.reject(error)
    }

    retriedRequests.add(originalRequest)

    try {
      // `refreshAccessToken()` (Bloque 1) ya garantiza una unica
      // renovacion real en vuelo — si varias peticiones llegan aca al
      // mismo tiempo, todas esperan la MISMA promesa y todas retoman
      // con el mismo token nuevo, sin disparar renovaciones paralelas.
      const newAccessToken = await refreshAccessToken()

      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

      return httpClient(originalRequest)
    } catch {
      // El refresh en si fallo (refresh token vencido, revocado, o sin
      // cookie) — la sesion actual ya no es recuperable, se cierra
      // (Bloque 3: mismo flujo de limpieza que el logout manual, via
      // `performLogout()`).
      await performLogout()
      return Promise.reject(error)
    }
  },
)
