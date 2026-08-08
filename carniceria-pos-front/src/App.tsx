import { useCallback, useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { AppRouter } from '@/routes'
import { refreshAccessToken } from '@/lib/htpp/refreshManager'
import { useIdleTimer } from '@/hooks/useIdleTimer'
import { LockScreen } from '@/features/auth/components/LockScreen'
import { UpdateReadyDialog } from '@/components/common/UpdateReadyDialog'
import { useAuthStore } from '@/stores/authStore'

/**
 * Bloque 7.24: senal de arranque real de la app de escritorio, expuesta de
 * forma sincrona por `preload.ts` de `carniceria-pos-desktop` (mismo
 * patron que `__DESKTOP_API_BASE_URL__` en `lib/htpp/client.ts`) —
 * autoridad real del proceso Main de Electron, no una heuristica del
 * renderer. En build web (sin Electron) queda `undefined`.
 */
declare global {
  interface Window {
    __DESKTOP_IS_COLD_BOOT__?: boolean
  }
}

/** Fallback para el build web: `sessionStorage` sobrevive una recarga
 * (F5) pero se pierde al cerrar la pestaña/ventana — comportamiento de
 * especificacion, no un hack (a diferencia de intentar lo mismo con
 * `sessionStorage` DENTRO de Electron, donde no hay garantia equivalente
 * frente al watchdog/recreacion de ventana, ver ROADMAP.md Bloque 7.24). */
const WEB_SESSION_MARKER_KEY = 'appSessionActive'

function isColdBoot(): boolean {
  if (typeof window.__DESKTOP_IS_COLD_BOOT__ === 'boolean') {
    return window.__DESKTOP_IS_COLD_BOOT__
  }

  const alreadyActive = sessionStorage.getItem(WEB_SESSION_MARKER_KEY) === 'true'
  sessionStorage.setItem(WEB_SESSION_MARKER_KEY, 'true')
  return !alreadyActive
}

/** Bloque 7.24: minutos de inactividad antes de bloquear la pantalla —
 * constante ajustable, mismo criterio que `ALEGRA_REQUEST_TIMEOUT_MS` del
 * backend (valor fijo con comentario, sin variable de entorno nueva para
 * mantener el cambio minimo). */
const IDLE_LOCK_TIMEOUT_MS = 5 * 60 * 1000

function App() {
  const [isInitializing, setIsInitializing] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const accessToken = useAuthStore((state) => state.accessToken)

  // Refresh silencioso al arrancar (A-01): el accessToken solo vive en
  // memoria y se pierde en cada recarga; se intenta recuperarlo usando
  // la cookie httpOnly del refresh token (enviada automaticamente por
  // httpClient, withCredentials: true). Si falla (sin cookie, cookie
  // vencida, etc.) se continua como usuario no autenticado, sin
  // reintentar ni mostrar ningun error — el usuario simplemente ve el
  // login, como si nunca hubiese iniciado sesion.
  //
  // Estabilidad de sesion, Bloque 1: usa el mismo administrador
  // centralizado (`refreshAccessToken`) que el interceptor de Axios
  // usara en el bloque siguiente — ya no duplica aqui la asignacion de
  // `accessToken` al store (el manager lo hace). Ademas, el mutex del
  // manager colapsa a UNA sola peticion real las dos invocaciones que
  // React StrictMode dispara en desarrollo para este mismo efecto.
  //
  // Bloque 7.24 (seguridad de sesion del escritorio): si esta peticion
  // corre justo despues de un reinicio COMPLETO de la app (cold boot,
  // `isColdBoot()`), NO se dispara — la sesion anterior no se restaura
  // sola, sin importar que la cookie httpOnly siga siendo valida. Una
  // recarga en caliente dentro del mismo proceso (`isColdBoot() === false`)
  // sigue funcionando exactamente igual que antes de este bloque.
  useEffect(() => {
    let isMounted = true

    const finishInitializing = () => {
      if (isMounted) {
        setIsInitializing(false)
      }
    }

    if (isColdBoot()) {
      // Diferido (no una llamada sincrona dentro del cuerpo del efecto,
      // regla `react-hooks/set-state-in-effect`) — mismo `finally` que la
      // rama de abajo, solo que sin disparar ningun refresh.
      Promise.resolve().then(finishInitializing)
    } else {
      refreshAccessToken()
        .catch(() => {
          // Silencioso a proposito: no autenticado es un estado valido.
        })
        .finally(finishInitializing)
    }

    return () => {
      isMounted = false
    }
  }, [])

  // Bloque 7.24: bloqueo automatico por inactividad, NUNCA logout — no
  // toca accessToken/refreshToken/cashSessionId, solo superpone
  // `LockScreen`. Deshabilitado sin sesion activa (login, o ya bloqueada)
  // para no reiniciar timers de mas.
  const handleIdle = useCallback(() => {
    setIsLocked(true)
  }, [])

  useIdleTimer(IDLE_LOCK_TIMEOUT_MS, handleIdle, Boolean(accessToken) && !isLocked)

  if (isInitializing) {
    return null
  }

  return (
    <>
      <AppRouter />
      {/* Bloque 7.27: offset vertical propio (config nativa de Sonner, sin
          logica nueva) — el default de la libreria (24px desde arriba) hace
          que la pila de toasts se dibuje encima de la campana de
          notificaciones y el menu "..." del header del POS (ver
          `PosHeader.tsx`, ambos quedan a ~64-72px del borde superior) y del
          header del Backoffice (`DashboardHeader.tsx`, ~64px). 88px deja a
          los toasts siempre por debajo de ambos headers, en cualquier
          pantalla que use este mismo `Toaster` global. */}
      <Toaster richColors position="top-right" offset={{ top: 88 }} />
      {/* Bloque 7.25: no-op fuera de Electron (guard interno en el propio
          componente) — puede montarse siempre, sin condicion. */}
      <UpdateReadyDialog />
      {isLocked && <LockScreen onUnlock={() => setIsLocked(false)} />}
    </>
  )
}

export default App