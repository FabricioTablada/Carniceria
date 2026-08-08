import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface ProductsTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Rediseño de Workspace de Productos (aprobado): sin borde/sombra/
   * rounded propios para embeberse dentro del Workspace unico (KPIs y
   * filtros ya visibles durante la carga inicial) en vez de reemplazar
   * toda la pantalla. `false` por defecto: comportamiento identico a
   * antes de este prop. */
  bare?: boolean
}

/**
 * features/products/components/ProductsTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 7 (pulido final): reemplaza el
 * `<LoadingState message="Cargando productos..." />` (texto plano) que
 * `ProductsPage.tsx` mostraba mientras `useProducts` resolvia — primer
 * consumidor real de `Skeleton.tsx` (`components/common/`, ya existente
 * pero sin uso hasta ahora, ver su propio comentario "hoy no hay ningun
 * estado de carga visual en el proyecto").
 *
 * Replica el markup/anchos de `ProductsTable.tsx` (mismo wrapper
 * `rounded-xl border bg-card shadow-sm`, misma altura de fila `py-2.5`,
 * mismas 5 columnas) para que la transicion real→skeleton→real no salte
 * de tamaño — el usuario ve la forma de sus datos antes de que lleguen,
 * no un spinner generico desconectado de lo que esta cargando.
 *
 * Presentacion pura: no sabe nada de `useProducts` ni de ningun estado de
 * carga — `ProductsPage.tsx` decide cuando montarlo.
 */
export function ProductsTableSkeleton({ rows = 8, bare = false }: ProductsTableSkeletonProps) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        !bare && 'rounded-xl border border-border/60 bg-card shadow-sm',
      )}
    >
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-[26%] h-3 w-16" />
        <Skeleton className="ml-auto h-3 w-24" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
        >
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3.5 w-16 shrink-0" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
