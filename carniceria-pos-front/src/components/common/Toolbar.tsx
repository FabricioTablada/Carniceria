import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ToolbarProps {
  /** Búsqueda + filtros del listado (típicamente `<XxxFilters>` ya
   * existente del módulo — este componente no sabe qué hay adentro). */
  filters: ReactNode
  /** Botones de la derecha: exportar, "Nuevo X", etc. Opcional — un
   * listado sin acciones (ej. de solo lectura) sigue funcionando. */
  actions?: ReactNode
  /** Rediseño de Workspace de Productos (aprobado): sin tarjeta propia
   * (`border`/`shadow`/`rounded`/`bg-card`/`p-4`) para anidarse como una
   * franja mas de un Workspace unico que ya aporta esa superficie —
   * mismo layout responsive (`flex-row` en desktop, `flex-col` en
   * mobile), solo sin envoltorio. `false` por defecto: ningun consumidor
   * existente cambia si no lo pasa. */
  bare?: boolean
}

/**
 * components/common/Toolbar.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 3: una sola barra de trabajo que integra
 * búsqueda/filtros (izquierda) y acciones (derecha) — reemplaza el patrón
 * anterior de "botón de acción en el `PageHeader`" + "filtros en su propio
 * bloque debajo" por una sola composición.
 *
 * Presentacion pura, mismo criterio de responsabilidad que `PageHeader`/
 * `FilterBar`: no sabe qué hay dentro de `filters`/`actions`, solo decide
 * el layout alrededor — el módulo que lo usa sigue siendo dueño de su
 * propia lógica de filtrado y de qué botones mostrar.
 *
 * Solo tokens ya existentes (`bg-card`, `border-border`) — ningún color
 * nuevo. Primer consumidor: Productos (módulo piloto); queda disponible
 * para el resto del ERP cuando le toque su propio bloque de propagación.
 */
export function Toolbar({ filters, actions, bare = false }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between',
        !bare && 'rounded-xl border border-border bg-card p-4 shadow-sm',
      )}
    >
      <div className="min-w-0 flex-1">{filters}</div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
