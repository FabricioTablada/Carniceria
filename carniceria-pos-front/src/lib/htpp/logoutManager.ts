import { queryClient } from '@/lib/query/queryClient'
import { useAuthStore } from '@/stores/authStore'

/**
 * lib/htpp/logoutManager.ts
 * -----------------------------------------------------------------------------
 * Estabilidad de sesion, Bloque 3: unico punto de entrada para la limpieza
 * de sesion en el cliente, compartido por el logout manual (boton "Cerrar
 * sesion", `DashboardLayout.tsx`) y el logout automatico (interceptor de
 * `client.ts` cuando el refresh reactivo del Bloque 2 falla). Antes cada
 * flujo repetia por su cuenta un subconjunto distinto de estos pasos — el
 * manual cancelaba y limpiaba la cache de TanStack Query ademas de llamar
 * a `authStore.logout()`, el automatico solo llamaba a `authStore.logout()`
 * y confiaba en el redirect reactivo de `ProtectedRoute` — dejando
 * peticiones en curso y datos ya cacheados de la sesion anterior vivos
 * tras un logout automatico.
 *
 * Deliberadamente NO incluye la llamada a `authApi.logout()` (revocar el
 * refresh token en el servidor): eso sigue siendo responsabilidad
 * exclusiva del logout manual. Cuando el logout es automatico, ya fallo
 * un refresh — el refresh token ya es invalido o esta revocado en el
 * servidor, por lo que no hay nada que revocar, y `/auth/logout` no esta
 * excluido del interceptor de respuestas (a diferencia de `/auth/login` y
 * `/auth/refresh`): llamarlo aqui arriesgaria un segundo 401 reentrando en
 * este mismo flujo. La limpieza del lado del cliente (estado, peticiones
 * en curso, cache) es identica en ambos casos; la llamada de red al
 * servidor no lo es, por diseño.
 */
export async function performLogout(): Promise<void> {
  await queryClient.cancelQueries()
  queryClient.clear()
  useAuthStore.getState().logout()
}
