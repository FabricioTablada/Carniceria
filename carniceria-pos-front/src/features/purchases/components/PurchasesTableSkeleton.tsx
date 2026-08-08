import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface PurchasesTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Rediseño de Compras (Canvas Workspace, aprobado): sin borde/sombra/
   * rounded propios para embeberse dentro del Workspace único — mismo
   * prop/criterio ya usado en `SuppliersTableSkeleton.tsx`/
   * `InventoryTableSkeleton.tsx`. */
  bare?: boolean
}

/**
 * features/purchases/components/PurchasesTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Mismo patron que `SuppliersTableSkeleton.tsx`/`InventoryTableSkeleton.tsx`.
 * Forma propia: checkbox, Documento+Fecha, Proveedor, Estado, Total,
 * Acciones.
 */
export function PurchasesTableSkeleton({ rows = 8, bare = false }: PurchasesTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden', !bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-[30%] h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0">
          <Skeleton className="size-4 shrink-0 rounded" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-3.5 w-28 shrink-0" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-20 shrink-0" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
