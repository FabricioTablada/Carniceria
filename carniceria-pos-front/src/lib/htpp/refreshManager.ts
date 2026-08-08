import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/stores/authStore'

/**
 * lib/htpp/refreshManager.ts
 * -----------------------------------------------------------------------------
 * Estabilidad de sesion, Bloque 1 (infraestructura): unico punto de entrada
 * para renovar el access token, con un mutex de una sola llamada en vuelo.
 * No modifica el interceptor de `client.ts` — eso es el bloque siguiente
 * (reintento de la peticion original tras 401). Este archivo vive junto a
 * `client.ts` porque es infraestructura del cliente HTTP, no un caso de uso
 * de un modulo de features — mismo criterio que `client.ts` ya establece.
 *
 * Por que un mutex es un requisito de SEGURIDAD, no solo de eficiencia: el
 * backend rota el refresh token en cada `POST /auth/refresh` y detecta el
 * REUSO de un refresh token ya rotado — si eso ocurre, revoca TODOS los
 * refresh tokens activos del usuario (ver analisis de estabilidad de
 * sesion ya aprobado). Dos llamadas paralelas a `/auth/refresh` en el
 * mismo instante (ej. varias peticiones 401 a la vez, o React StrictMode
 * invocando un efecto dos veces en desarrollo) usarian la MISMA cookie de
 * refresh token vigente; la segunda en llegar al backend encontraria el
 * token ya rotado por la primera y dispararia exactamente ese
 * kill-switch. Este modulo garantiza que, sin importar cuantas veces se
 * llame a `refreshAccessToken()` mientras una renovacion ya esta en
 * curso, exista una unica peticion real HTTP — todas las llamadas
 * concurrentes reciben la MISMA promesa (el mismo resultado, exito o
 * error).
 */
let inFlightRefresh: Promise<string> | null = null

/**
 * Renueva el access token. Si ya hay una renovacion en curso, devuelve esa
 * MISMA promesa en vez de disparar una peticion nueva — el llamador no
 * necesita saber si "inicio" la renovacion o simplemente se sumo a una ya
 * en marcha, el resultado es identico. Al resolver (exito o error) libera
 * el mutex (`finally`), para que la proxima llamada — ya sea porque el
 * access token volvio a expirar, o porque esta renovacion fallo y hace
 * falta reintentar mas adelante — dispare una peticion real nueva.
 *
 * Actualiza `authStore.accessToken` en caso de exito (mismo efecto que ya
 * tenia el refresh silencioso de `App.tsx`) — asi cualquier consumidor
 * futuro (el interceptor de `client.ts`, en el bloque siguiente) solo
 * necesita esperar esta promesa y volver a leer el token del store, sin
 * duplicar esa asignacion en cada punto de llamada.
 */
export function refreshAccessToken(): Promise<string> {
  if (inFlightRefresh) {
    return inFlightRefresh
  }

  inFlightRefresh = authApi
    .refresh()
    .then(({ accessToken }) => {
      useAuthStore.getState().setAccessToken(accessToken)
      return accessToken
    })
    .finally(() => {
      inFlightRefresh = null
    })

  return inFlightRefresh
}

/** Expuesto SOLO para pruebas/diagnostico (ej. confirmar que el mutex esta
 * libre entre escenarios) — ningun codigo de produccion debe depender de
 * este valor para tomar decisiones. */
export function isRefreshInFlight(): boolean {
  return inFlightRefresh !== null
}
