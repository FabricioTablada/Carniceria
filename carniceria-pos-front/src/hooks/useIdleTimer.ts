import { useEffect, useRef } from 'react'

/**
 * hooks/useIdleTimer.ts
 * -----------------------------------------------------------------------------
 * Bloque 7.24 (seguridad de sesion del escritorio): hook generico y unico
 * para detectar inactividad del usuario — no existia ningun hook
 * reutilizable de listeners globales/temporizadores en el proyecto antes
 * de este bloque (se revisaron `src/hooks/` y los `window.addEventListener`
 * de `SalesPOSPage.tsx`/`PosLayout.tsx`/paginas de listado: todos son
 * atajos de teclado puntuales, ninguno generico ni reutilizable). Mismo
 * criterio que `useDebouncedValue.ts`: no sabe nada de autenticacion ni de
 * bloqueo de pantalla, solo invoca `onIdle` tras `timeoutMs` sin actividad
 * de mouse/teclado — la logica de que hacer con eso vive en quien lo usa.
 *
 * Sin dependencias externas (misma convencion que los atajos de teclado
 * ya usados en el proyecto: `window.addEventListener` crudo dentro de un
 * `useEffect`, sin libreria).
 */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const

export function useIdleTimer(timeoutMs: number, onIdle: () => void, enabled = true): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(onIdle, timeoutMs)
    }

    resetTimer()

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetTimer)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetTimer)
      }
    }
  }, [timeoutMs, onIdle, enabled])
}
