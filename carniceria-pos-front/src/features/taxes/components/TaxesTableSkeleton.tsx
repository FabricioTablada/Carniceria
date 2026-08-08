import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface TaxesTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Workspace Impuestos (aprobado): sin borde/sombra/rounded propios
   * para embeberse dentro del Workspace unico — mismo prop, mismo
   * criterio y mismo default (`false`) ya usado en
   * `ProductsTableSkeleton.tsx`/`CategoriesTableSkeleton.tsx`. */
  bare?: boolean
}

/**
 * features/taxes/components/TaxesTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion de `ProductsTableSkeleton.tsx`/`CategoriesTableSkeleton.tsx`
 * — mismo patron (wrapper `rounded-xl border bg-card shadow-sm`, misma
 * altura de fila `py-2.5`, `Skeleton` de `components/common/`), forma
 * propia: sin miniatura ni badge de padre, columnas Nombre (con codigo
 * como subtexto)/Tasa/Estado/Acciones.
 */
export function TaxesTableSkeleton({ rows = 8, bare = false }: TaxesTableSkeletonProps) {
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
        <Skeleton className="ml-[30%] h-3 w-12" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
        >
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
