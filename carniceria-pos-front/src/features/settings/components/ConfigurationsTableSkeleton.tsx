import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface ConfigurationsTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 5 */
  rows?: number
  /** Sin borde/sombra/rounded propios para embeberse dentro del Canvas
   * Workspace de `SettingsPage.tsx` (mismo criterio que
   * `ProductsTableSkeleton.tsx`). `false` por defecto. */
  bare?: boolean
}

/**
 * features/settings/components/ConfigurationsTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.29D.1 (paridad visual con Productos): reemplaza el
 * `<LoadingState message="Cargando configuraciones..." />` (texto plano)
 * que `SettingsPage.tsx` mostraba mientras `useConfigurations` resolvía —
 * mismo componente primitivo (`Skeleton.tsx`) y misma técnica que
 * `ProductsTableSkeleton.tsx`, adaptada a las columnas reales de
 * `ConfigurationsTable.tsx` (Clave/Valor/Tipo/Descripción/Acciones — sin
 * miniatura, esta tabla no tiene ninguna).
 */
export function ConfigurationsTableSkeleton({ rows = 5, bare = false }: ConfigurationsTableSkeletonProps) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        !bare && 'rounded-xl border border-border/60 bg-card shadow-sm',
      )}
    >
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-[20%] h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="ml-auto h-3 w-24" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-28 shrink-0" />
          <Skeleton className="h-3.5 w-32 shrink-0" />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
