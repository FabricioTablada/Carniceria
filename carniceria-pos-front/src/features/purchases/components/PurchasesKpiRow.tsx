import { CheckCircle2, FileClock, ShoppingCart, XCircle } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { usePurchases } from '../hooks/usePurchases'
import type { PurchaseStatus } from '../types/purchase.types'

function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface PurchasesKpiRowProps {
  /** Filtro "Estado" actualmente activo en `PurchasesPage.tsx` — determina
   * qué celda se muestra "presionada". `undefined` = todos. */
  activeStatus: PurchaseStatus | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange` que
   * ya usa `PurchaseFilters`, sin lógica de filtrado nueva. */
  onSelectStatus: (status: PurchaseStatus | undefined) => void
}

/**
 * features/purchases/components/PurchasesKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras (Canvas Workspace, aprobado): pasa de una grilla de
 * `KpiCard` individuales a la misma franja `bare`/`xs` clicable dividida
 * por `divide-x` ya usada en Proveedores/Productos/Categorías/Impuestos/
 * Inventario/Lotes — mismo criterio "solo información ya disponible":
 * `status` ya es un filtro real y soportado por `usePurchases` (no un
 * cálculo nuevo), así que cada celda es una consulta `limit: 1` adicional
 * (mismo patrón "Activos/Inactivos" del resto del ERP). Se agrega
 * "Canceladas" (mismo criterio, tercer valor real de `PurchaseStatus`)
 * para que las 3 celdas de estado sumen exactamente el total.
 */
export function PurchasesKpiRow({ activeStatus, onSelectStatus }: PurchasesKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = usePurchases({ limit: 1 })
  const { data: receivedResponse, isLoading: isReceivedLoading } = usePurchases({
    status: 'RECEIVED',
    limit: 1,
  })
  const { data: draftResponse, isLoading: isDraftLoading } = usePurchases({
    status: 'DRAFT',
    limit: 1,
  })
  const { data: cancelledResponse, isLoading: isCancelledLoading } = usePurchases({
    status: 'CANCELLED',
    limit: 1,
  })

  const total = totalResponse?.meta.total
  const received = receivedResponse?.meta.total
  const draft = draftResponse?.meta.total
  const cancelled = cancelledResponse?.meta.total

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
      <button
        type="button"
        onClick={() => onSelectStatus(undefined)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === undefined && 'bg-brand/5 shadow-[inset_0_-2px_0_var(--brand)]',
        )}
      >
        <KpiCard bare label="Compras" value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')} icon={ShoppingCart} size="xs" />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'RECEIVED' ? undefined : 'RECEIVED')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'RECEIVED' && 'bg-success/5 shadow-[inset_0_-2px_0_var(--success)]',
        )}
      >
        <KpiCard bare label="Recibidas" value={isReceivedLoading ? <KpiValueSkeleton /> : (received ?? '—')} icon={CheckCircle2} size="xs" tone="success" />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'DRAFT' ? undefined : 'DRAFT')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'DRAFT' && 'bg-muted shadow-[inset_0_-2px_0_var(--muted-foreground)]',
        )}
      >
        <KpiCard bare label="Borradores" value={isDraftLoading ? <KpiValueSkeleton /> : (draft ?? '—')} icon={FileClock} size="xs" tone="muted" />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'CANCELLED' ? undefined : 'CANCELLED')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'CANCELLED' && 'bg-destructive/5 shadow-[inset_0_-2px_0_var(--destructive)]',
        )}
      >
        <KpiCard bare label="Canceladas" value={isCancelledLoading ? <KpiValueSkeleton /> : (cancelled ?? '—')} icon={XCircle} size="xs" tone={(cancelled ?? 0) > 0 ? 'muted' : 'success'} />
      </button>
    </div>
  )
}
