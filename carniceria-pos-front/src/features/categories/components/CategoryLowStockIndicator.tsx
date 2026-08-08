import { TriangleAlert } from 'lucide-react'
import { useLowStock } from '@/features/reports/hooks/useLowStock'

interface CategoryLowStockIndicatorProps {
  categoryId: string
}

/**
 * features/categories/components/CategoryLowStockIndicator.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Categorías (workspace, aprobado): indicador compacto de bajo
 * stock por categoría — reutiliza `useLowStock({ categoryId })` (mismo
 * hook/filtro que ya usan `LowStockPage.tsx`/`InventoryAlertsPage.tsx` y el
 * panel "Productos con bajo stock" del Dashboard), sin ningún endpoint ni
 * cálculo nuevo. No renderiza nada cuando no hay productos en bajo stock
 * (mismo criterio de "degradación silenciosa" que el resto de indicadores
 * opcionales del proyecto).
 */
export function CategoryLowStockIndicator({ categoryId }: CategoryLowStockIndicatorProps) {
  const { data } = useLowStock({ categoryId })

  if (!data || data.length === 0) {
    return null
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-amber/15 px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-accent-amber">
      <TriangleAlert className="size-3" />
      {data.length} bajo stock
    </span>
  )
}
