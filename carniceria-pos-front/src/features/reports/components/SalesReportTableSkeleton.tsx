import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface SalesReportTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Centro de Análisis (aprobado): sin borde/sombra/rounded propios para
   * embeberse dentro del Canvas Workspace único — mismo prop/criterio ya
   * usado en `CategoriesTableSkeleton.tsx`/`UsersTableSkeleton.tsx`.
   * `false` por defecto: sin cambios si no se pasa. */
  bare?: boolean
}

/**
 * features/reports/components/SalesReportTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: mismo patron ya usado en `ProductsTableSkeleton.tsx`/
 * `TaxesTableSkeleton.tsx` (wrapper `rounded-xl border bg-card shadow-sm`,
 * `Skeleton` de `components/common/`), adaptado a las columnas reales de
 * `SalesReportTable.tsx` (Documento/Fecha/Sucursal/Usuario/Método de
 * pago/Referencia/Subtotal/Impuesto/Descuento/Total) — sin casilla de
 * seleccion ni miniatura, esta tabla no las tiene.
 */
export function SalesReportTableSkeleton({ rows = 8, bare = false }: SalesReportTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden', !bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-20 shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
