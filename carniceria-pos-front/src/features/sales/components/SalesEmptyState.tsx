import { ReceiptText, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'

interface SalesEmptyStateProps {
  /** `true` si el listado está vacío por los filtros activos (no porque
   * la sesión no tenga ventas todavía) — cambia el ícono, el texto y la
   * acción. */
  isFiltered: boolean
  /** Solo relevante cuando `isFiltered` es `true`: limpia los filtros. */
  onClearFilters?: () => void
  /** Solo relevante cuando `isFiltered` es `false`: navega al POS para
   * registrar la primera venta de la sesión. */
  onGoToPos?: () => void
}

/**
 * features/sales/components/SalesEmptyState.tsx
 * -----------------------------------------------------------------------------
 * Bloque 11 (rediseño integral de Ventas): mismo criterio que
 * `ProductsEmptyState.tsx` — distingue "0 resultados para estos filtros"
 * de "la sesión todavía no tiene ventas", en vez del string plano que
 * `SalesTable.tsx` mostraba por defecto. `hasActiveFilters` lo calcula
 * `SalesPage.tsx` a partir del `filters` que ya tiene (sin lógica nueva).
 *
 * A diferencia de Productos, no hay un "crear" real desde esta pantalla
 * (una venta no se crea acá, se crea en el POS) — la acción para el caso
 * "sin ventas todavía" navega a `/sales/pos`, el único lugar real donde
 * eso pasa.
 */
export function SalesEmptyState({ isFiltered, onClearFilters, onGoToPos }: SalesEmptyStateProps) {
  if (isFiltered) {
    return (
      <EmptyState
        icon={SearchX}
        title="Sin resultados para estos filtros"
        description="Probá ajustar el estado, el cajero o la sucursal seleccionados."
        action={onClearFilters ? { label: 'Limpiar filtros', onClick: onClearFilters } : undefined}
      />
    )
  }

  return (
    <EmptyState
      icon={ReceiptText}
      title="Todavía no hay ventas en esta sesión"
      description="Las ventas que registrés en el POS van a aparecer acá."
      action={onGoToPos ? { label: 'Ir al POS', onClick: onGoToPos, variant: 'brand' } : undefined}
    />
  )
}
