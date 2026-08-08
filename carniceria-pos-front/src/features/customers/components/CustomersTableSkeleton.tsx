import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface CustomersTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Sin borde/sombra/rounded propios para embeberse dentro del Workspace
   * unico — mismo prop y criterio que `SuppliersTableSkeleton.tsx`. */
  bare?: boolean
}

/**
 * features/customers/components/CustomersTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — adaptacion de `SuppliersTableSkeleton.tsx`: mismo patron,
 * forma propia: Cliente (icono+nombre+identificacion), Contacto
 * (correo+telefono), Estado, Acciones.
 */
export function CustomersTableSkeleton({ rows = 8, bare = false }: CustomersTableSkeletonProps) {
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
        <Skeleton className="ml-[20%] h-3 w-16" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
