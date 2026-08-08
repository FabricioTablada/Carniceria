/**
 * utils/formatRelativeTime.ts
 * -----------------------------------------------------------------------------
 * Bloque Usuarios (aprobado, "Último acceso más visual"): formatea un
 * timestamp como tiempo relativo ("Hace 5 min", "Hace 3 h", "Hace 2 d")
 * en vez de la fecha/hora absoluta. Mismo dato de siempre (`lastLoginAt`
 * u otro timestamp ISO) — esto NO es un indicador de presencia en vivo
 * (el sistema no tiene sesiones en tiempo real ni heartbeat): es
 * simplemente una presentación distinta del mismo timestamp ya existente.
 *
 * Mas alla de 7 dias, cae al formato absoluto ya existente
 * (`formatDateTime`) — una fecha relativa de "hace 45 dias" deja de ser
 * util, la fecha exacta comunica mejor.
 */
import { formatDateTime } from './formatDateTime'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const RELATIVE_CUTOFF_MS = 7 * DAY_MS

/**
 * Formatea `value` (ISO string) como tiempo relativo. Devuelve `'—'` si
 * `value` es `null`/`undefined`/invalido — mismo criterio que
 * `formatDateTime`.
 */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const diffMs = Date.now() - date.getTime()

  if (diffMs < 0 || diffMs >= RELATIVE_CUTOFF_MS) {
    return formatDateTime(value)
  }

  if (diffMs < MINUTE_MS) {
    return 'Justo ahora'
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    return `Hace ${minutes} min`
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `Hace ${hours} h`
  }

  const days = Math.floor(diffMs / DAY_MS)
  return `Hace ${days} d`
}
