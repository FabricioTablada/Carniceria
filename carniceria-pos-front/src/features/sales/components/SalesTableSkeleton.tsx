import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface SalesTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Centro de Operaciones (aprobado): sin borde/sombra/rounded propios
   * para embeberse dentro del Canvas Workspace único de `SalesPage.tsx`
   * — mismo prop/criterio ya usado en `CategoriesTableSkeleton.tsx`/
   * `UsersTableSkeleton.tsx`/los skeletons de Reportes. `false` por
   * defecto: sin cambios si no se pasa. */
  bare?: boolean
}

/**
 * features/sales/components/SalesTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque 11 (rediseño integral de Ventas): reemplaza el
 * `<LoadingState message="Cargando ventas..." />` (texto plano) de
 * `SalesPage.tsx` — mismo criterio que `ProductsTableSkeleton.tsx`
 * (Sprint UX/UI PIPASA V1, Bloque 7): replica el markup/anchos de
 * `SalesTable.tsx` (mismo wrapper `rounded-xl border bg-card shadow-sm`,
 * misma altura de fila `py-4`, mismas 6 columnas + acción) para que la
 * transición real→skeleton→real no salte de tamaño.
 *
 * Presentación pura: no sabe nada de `useSales` ni de ningún estado de
 * carga — `SalesPage.tsx` decide cuándo montarlo.
 */
export function SalesTableSkeleton({ rows = 8, bare = false }: SalesTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden', !bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      <div className="flex items-center gap-6 border-b bg-muted/50 px-5 py-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-6 border-b px-5 py-4 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-20 shrink-0" />
          <Skeleton className="h-3.5 w-16 shrink-0" />
          <Skeleton className="h-3.5 w-20 shrink-0" />
          <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
          <Skeleton className="ml-auto h-3.5 w-16 shrink-0" />
          <Skeleton className="h-3.5 w-28 shrink-0" />
          <Skeleton className="h-6 w-9 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
