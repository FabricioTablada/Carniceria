import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProductsBulkActionsBarProps {
  /** Cantidad de filas seleccionadas en la pagina actual — `ProductsPage.tsx`
   * solo monta este componente cuando es mayor a 0. */
  count: number
  /** Exporta unicamente las filas seleccionadas — mismo `handleExport` que
   * ya usaba el boton "Exportar" del Toolbar cuando habia seleccion. */
  onExport: () => void
  /** Limpia la seleccion actual. */
  onClear: () => void
}

/**
 * features/products/components/ProductsBulkActionsBar.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Workspace de Productos (aprobado): antes, seleccionar filas
 * cambiaba en silencio el alcance del boton "Exportar" (de "toda la
 * pagina" a "solo lo seleccionado") sin ninguna señal en pantalla de
 * cuantas filas estaban marcadas. Esta franja reemplaza la fila de
 * filtros (`ProductFilters` dentro de `Toolbar`) cuando hay seleccion
 * activa, dentro del mismo Workspace — no agrega ninguna capacidad nueva:
 * `selectedIds` y el export-solo-seleccionados ya existian en
 * `ProductsPage.tsx`/`exportToCsv`, esto solo los hace visibles y
 * explicitos.
 */
export function ProductsBulkActionsBar({ count, onExport, onClear }: ProductsBulkActionsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand/5 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">
        {count} {count === 1 ? 'producto seleccionado' : 'productos seleccionados'}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-2">
          <Download className="size-3.5" />
          Exportar seleccionados
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="gap-2">
          <X className="size-3.5" />
          Limpiar selección
        </Button>
      </div>
    </div>
  )
}
