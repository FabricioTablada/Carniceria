import type { BadgeVariant } from '@/components/common/Badge'
import type { CashMovement } from '../types/cashSession.types'

export interface CashSessionInsights {
  totalIngresos: number
  totalEgresos: number
  movementsCount: number
  lastMovementAt: string | null
  lastIngreso: CashMovement | null
  lastEgreso: CashMovement | null
}

/**
 * features/cashSession/utils/cashSessionInsights.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Caja — única fuente de los agregados derivados de
 * `useCashMovements` (total de ingresos/egresos, último movimiento, último
 * ingreso/egreso) — reutilizada tanto por el panel superior persistente
 * como por el panel lateral de contexto (`CashSessionContextPanel.tsx`),
 * para no repetir el mismo `.reduce()`/`.filter()` en dos archivos.
 */
export function deriveCashSessionInsights(movements: CashMovement[]): CashSessionInsights {
  const sorted = [...movements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const totalIngresos = movements
    .filter((movement) => movement.type === 'CASH_IN')
    .reduce((sum, movement) => sum + movement.amount, 0)
  // QA.5 (Caja): `REFUND` (reembolso en efectivo de una devolución, Bloque
  // 4.1) es efectivo que sale de la caja igual que un `CASH_OUT` —
  // `cash/service.ts::computeExpectedAmount` (backend) ya lo resta del
  // efectivo esperado. Antes de esta corrección, este total (y por lo
  // tanto el "Esperado"/"Diferencia" en vivo de `CashArqueoPanel.tsx`, que
  // se arma a partir de este valor) no lo incluía — mostraba un efectivo
  // esperado MAYOR al que el backend calcula y persiste al cerrar la
  // sesión, exactamente el mismo defecto ya corregido del lado del
  // backend ("Sprint QA 1"), nunca propagado a este cálculo del frontend.
  const isEgresoLike = (movement: CashMovement) =>
    movement.type === 'CASH_OUT' || movement.type === 'REFUND'
  const totalEgresos = movements
    .filter(isEgresoLike)
    .reduce((sum, movement) => sum + movement.amount, 0)

  return {
    totalIngresos,
    totalEgresos,
    movementsCount: movements.length,
    lastMovementAt: sorted[0]?.createdAt ?? null,
    lastIngreso: sorted.find((movement) => movement.type === 'CASH_IN') ?? null,
    lastEgreso: sorted.find(isEgresoLike) ?? null,
  }
}

/**
 * Mejoras UX de Caja (aprobado, "Hero de Sesión Activa"/"Hero dinámico del
 * Drawer"): mismo cálculo que ya usaba `OpenCashSessionPage.tsx`
 * (`formatElapsedSince`, ahora compartido en vez de vivir local a una sola
 * página) — formatea el tiempo entre dos timestamps como "Xh Ym" (o solo
 * "Ym" si es menos de una hora). Sin `endIso`, usa el momento actual
 * ("tiempo transcurrido" de una sesión abierta); con `endIso`, la
 * "duración" de una sesión ya cerrada (`openedAt` → `closedAt`) — misma
 * fórmula, dos lecturas distintas del mismo dato.
 */
export function formatElapsedSince(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const elapsedMinutes = Math.max(0, Math.floor((end - start) / 60000))
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export interface ArqueoResult {
  label: string
  variant: BadgeVariant
}

/**
 * Mejoras UX de Caja (aprobado, "mejoras visuales de la tabla"/"Hero
 * dinámico del Drawer"): único lugar que traduce `CashSession.difference`
 * a la etiqueta Cuadra/Sobrante/Faltante — antes vivía duplicado a mano en
 * `CashSessionsTable.tsx`. Mismo criterio de signo que `CashArqueoPanel.tsx`
 * (diferencia positiva = sobrante, negativa = faltante), ningún cálculo
 * nuevo.
 */
export function getArqueoResult(difference: number | null): ArqueoResult {
  if (difference === null) {
    return { label: 'Pendiente', variant: 'muted' }
  }
  if (difference === 0) {
    return { label: 'Cuadra', variant: 'secondary' }
  }
  return difference > 0
    ? { label: 'Sobrante', variant: 'muted' }
    : { label: 'Faltante', variant: 'destructive' }
}
