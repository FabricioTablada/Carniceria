import { cn } from '@/lib/utils'
import { formatQuantity, type QuantityUnit } from '@/utils/formatQuantity'
import { resolveStockStatus } from '@/utils/stockStatus'

/**
 * components/common/StockStatusBadge.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — Inventario. Reemplaza el texto de "Cantidad"
 * que antes se mostraba siempre en rojo (`text-brand`/`text-destructive`
 * fijo), sin importar si el stock estaba bien o no — hallazgo del
 * análisis UX ("el indicador de cantidad no refleja el estado real del
 * stock").
 *
 * Mismo patrón dot+texto ya prototipado (pero nunca activado) en
 * `features/products/components/ProductDrawer.tsx` (`resolveStockStatus`
 * siempre devolvía `undefined`, a la espera de una regla real) — acá esa
 * regla ya existe (`reorderPoint` de Inventario), así que se implementa
 * como componente compartido en vez de duplicar el prototipo. No se toca
 * `ProductDrawer.tsx` (fuera de alcance de este sprint).
 *
 * `Badge` (`components/common/Badge.tsx`) no se reutiliza aquí a
 * propósito: sus 4 variantes (secondary/muted/accent/destructive) no
 * cubren "bajo stock"/"óptimo" (ámbar/verde), y agregarle esas dos
 * variantes solo para este caso iría en contra de su propio comentario
 * ("agregarlos ahora sería inventar un uso que no existe").
 */
const STOCK_STATUS_TOKENS: Record<'critical' | 'low' | 'optimal', { dot: string; text: string; tint: string }> = {
  critical: { dot: 'bg-destructive', text: 'text-destructive', tint: 'bg-destructive/10' },
  low: { dot: 'bg-accent-amber', text: 'text-accent-amber', tint: 'bg-accent-amber/10' },
  optimal: { dot: 'bg-success', text: 'text-success', tint: 'bg-success/10' },
}

const STOCK_STATUS_LABELS: Record<'critical' | 'low' | 'optimal', string> = {
  critical: 'Agotado',
  low: 'Bajo stock',
  optimal: 'Óptimo',
}

interface StockStatusBadgeProps {
  quantity: number
  unitOfMeasure: QuantityUnit
  reorderPoint: number | null
  className?: string
  /** Centro de Control de Inventario (aprobado): `'inline'` (default) es
   * el render de siempre — dot + cantidad, sin cambios para ninguno de
   * los consumidores existentes. `'chip'` (nuevo, `InventoryTable.tsx`)
   * es una píldora con fondo tenue + texto del estado (sin cantidad) —
   * misma resolución de estado (`resolveStockStatus`), solo otra
   * presentación para una columna "Estado" dedicada. */
  variant?: 'inline' | 'chip'
}

export function StockStatusBadge({
  quantity,
  unitOfMeasure,
  reorderPoint,
  className,
  variant = 'inline',
}: StockStatusBadgeProps) {
  const status = resolveStockStatus(quantity, reorderPoint)

  if (variant === 'chip') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          status ? STOCK_STATUS_TOKENS[status].tint : 'bg-muted',
          status ? STOCK_STATUS_TOKENS[status].text : 'text-muted-foreground',
          className,
        )}
      >
        {status && (
          <span className={cn('size-1.5 shrink-0 rounded-full', STOCK_STATUS_TOKENS[status].dot)} />
        )}
        {status ? STOCK_STATUS_LABELS[status] : 'Sin umbral'}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold tabular-nums',
        status ? STOCK_STATUS_TOKENS[status].text : 'text-foreground',
        className,
      )}
    >
      {status && (
        <span className={cn('size-1.5 shrink-0 rounded-full', STOCK_STATUS_TOKENS[status].dot)} />
      )}
      {formatQuantity(quantity, unitOfMeasure)}
    </span>
  )
}
