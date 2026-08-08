import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface PurchasesReportTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Centro de Análisis (aprobado): sin borde/sombra/rounded propios para
   * embeberse dentro del Canvas Workspace único. `false` por defecto. */
  bare?: boolean
}

/**
 * features/reports/components/PurchasesReportTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: mismo patron que `SalesReportTableSkeleton.tsx`,
 * adaptado a las columnas de `PurchasesReportTable.tsx` (Documento/Fecha/
 * Proveedor/Usuario/Estado/Subtotal/Impuesto/Total).
 */
export function PurchasesReportTableSkeleton({ rows = 8, bare = false }: PurchasesReportTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden', !bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-20 shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-28 shrink-0" />
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
