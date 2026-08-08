import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface TopProductsTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 10 */
  rows?: number
  /** Centro de Análisis (aprobado): sin borde/sombra/rounded propios para
   * embeberse dentro del Canvas Workspace único. `false` por defecto. */
  bare?: boolean
}

/**
 * features/reports/components/TopProductsTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-04: mismo patron que los skeletons de REPORTES-02,
 * adaptado a las columnas de `TopProductsTable.tsx` (Producto/SKU/
 * Categoría/Cantidad vendida/Importe vendido/Ventas). 10 filas por
 * defecto: mismo `DEFAULT_LIMIT` que ya usa `TopProductsPage.tsx`.
 */
export function TopProductsTableSkeleton({ rows = 10, bare = false }: TopProductsTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden', !bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-32 shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}
