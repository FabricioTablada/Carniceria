import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface UsersTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Canvas Workspace Usuarios (aprobado): sin borde/sombra/rounded
   * propios para embeberse dentro del Workspace unico — mismo prop, mismo
   * criterio y mismo default (`false`) ya usado en
   * `CategoriesTableSkeleton.tsx`/`ProductsTableSkeleton.tsx`. */
  bare?: boolean
}

/**
 * features/users/components/UsersTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Canvas Workspace Usuarios (aprobado): mismo patron que
 * `CategoriesTableSkeleton.tsx` (wrapper `rounded-xl border bg-card
 * shadow-sm`, `Skeleton` de `components/common/`), con la forma real de
 * ESTA tabla — avatar + nombre, usuario, correo, rol (badge), estado
 * (badge), ultimo acceso, acciones. Reemplaza el `<LoadingState
 * message="Cargando usuarios...">` generico que usaba `UsersPage.tsx`
 * antes de este bloque.
 */
export function UsersTableSkeleton({ rows = 8, bare = false }: UsersTableSkeletonProps) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        !bare && 'rounded-xl border border-border/60 bg-card shadow-sm',
      )}
    >
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="ml-[16%] h-3 w-20" />
        <Skeleton className="ml-[10%] h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-3 w-32 shrink-0" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
