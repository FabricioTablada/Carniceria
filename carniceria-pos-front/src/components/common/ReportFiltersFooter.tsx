import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportFiltersFooterProps {
  /** Si hay algun filtro activo — habilita "Limpiar filtros". El
   * componente no sabe que filtros existen, solo si limpiar tiene sentido
   * ahora mismo (mismo criterio que `ProductsPage.tsx::handleClearFilters`). */
  hasActiveFilters: boolean
  /** Se dispara al presionar "Limpiar filtros". */
  onClear: () => void
  /** Centro de Análisis (aprobado, "indicador de filtros activos"):
   * cuántos filtros están activos ahora mismo — cuando se recibe, se
   * muestra junto a "Limpiar filtros" (ej. "Limpiar filtros (2)"). Opcional
   * y aditivo: sin este prop, el texto queda exactamente igual que antes
   * de este bloque — ningún consumidor existente cambia si no lo pasa. */
  activeCount?: number
}

/**
 * components/common/ReportFiltersFooter.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02 (correccion, previo a replicar el patron a Compras/
 * Inventario/Utilidad): segunda fila de la maqueta aprobada de Reportes
 * ("Filtros avanzados" + "Limpiar filtros"), extraida de
 * `SalesReportFilters.tsx` — identica para cualquier reporte, ningun dato
 * de Ventas.
 *
 * "Filtros avanzados" existe visualmente como punto de entrada preparado
 * para un futuro set de filtros adicionales que hoy no existe en ningun
 * reporte — deshabilitado a proposito, no dispara ningun cambio de estado
 * ni de consulta. El dia que un reporte concreto necesite filtros
 * avanzados reales, ese boton se resuelve puntualmente (no aca, que sigue
 * siendo el estado "todavia no existe" para el resto).
 */
export function ReportFiltersFooter({ hasActiveFilters, onClear, activeCount }: ReportFiltersFooterProps) {
  return (
    <div className="flex items-center justify-between">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        title="Próximamente: mas filtros ademas de los ya disponibles arriba."
        className="gap-1.5 text-muted-foreground"
      >
        <SlidersHorizontal className="size-3.5" />
        Filtros avanzados
        <ChevronDown className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!hasActiveFilters}
        onClick={onClear}
        className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <RotateCcw className="size-3.5" />
        Limpiar filtros
        {activeCount !== undefined && activeCount > 0 && ` (${activeCount})`}
      </Button>
    </div>
  )
}
