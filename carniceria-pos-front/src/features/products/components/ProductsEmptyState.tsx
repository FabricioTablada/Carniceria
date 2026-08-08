import { PackageSearch, PackagePlus } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'

interface ProductsEmptyStateProps {
  /** `true` si el listado esta vacio por los filtros activos (no porque
   * el catalogo este vacio) — cambia el icono, el texto y la accion. */
  isFiltered: boolean
  /** Solo relevante cuando `isFiltered` es `true`: limpia los filtros. */
  onClearFilters?: () => void
  /** Solo relevante cuando `isFiltered` es `false`: crea el primer producto. */
  onCreateProduct?: () => void
}

/**
 * features/products/components/ProductsEmptyState.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 7: distingue "el catalogo esta vacio"
 * (icono `PackagePlus`, CTA "Nuevo Producto") de "0 resultados para estos
 * filtros" (icono `PackageSearch`, CTA "Limpiar filtros").
 *
 * Adaptacion de Categorias al estandar: el markup se extrajo a
 * `components/common/EmptyState.tsx` (generico, reutilizable) — este
 * componente ahora solo decide QUE icono/texto/accion mostrar para
 * Productos especificamente. Refactor puro: mismas clases, mismo DOM,
 * mismo comportamiento que antes de la extraccion.
 */
export function ProductsEmptyState({
  isFiltered,
  onClearFilters,
  onCreateProduct,
}: ProductsEmptyStateProps) {
  if (isFiltered) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Sin resultados para estos filtros"
        description="Probá ajustar la búsqueda o los filtros seleccionados."
        action={onClearFilters ? { label: 'Limpiar filtros', onClick: onClearFilters } : undefined}
      />
    )
  }

  return (
    <EmptyState
      icon={PackagePlus}
      title="Todavía no hay productos"
      description="Registrá tu primer producto para empezar a construir el catálogo."
      action={
        onCreateProduct
          ? { label: 'Nuevo Producto', onClick: onCreateProduct, variant: 'brand' }
          : undefined
      }
    />
  )
}
