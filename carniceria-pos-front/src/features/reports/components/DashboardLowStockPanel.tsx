import { PackageCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { formatQuantity } from '@/utils/formatQuantity'
import type { LowStockItem } from '../types/report.types'

const MAX_VISIBLE = 5

interface DashboardLowStockPanelProps {
  items: LowStockItem[]
  isLoading: boolean
  onViewMore: () => void
}

/**
 * features/reports/components/DashboardLowStockPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del Dashboard ("centro de control", aprobado): reutiliza
 * `useLowStock` (mismo hook que `LowStockPage.tsx`/`InventoryAlertsPage.tsx`)
 * — este componente es presentacion pura, recibe `items` ya cargados por
 * `DashboardPage.tsx`. No reutiliza `LowStockTable.tsx` (7 columnas,
 * pensada para una pagina de reporte dedicada): en un panel compacto de
 * Dashboard esas columnas forzarian scroll horizontal, exactamente lo que
 * este rediseño busca evitar — se muestra una lista compacta de las
 * primeras 5 filas en su lugar, con "Ver más" hacia el reporte completo.
 */
export function DashboardLowStockPanel({ items, isLoading, onViewMore }: DashboardLowStockPanelProps) {
  const visible = items.slice(0, MAX_VISIBLE)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="Sin productos en bajo stock"
        description="Todos los productos están por encima de su punto de reorden."
      />
    )
  }

  return (
    <div className="flex flex-col">
      {visible.map((item) => (
        <div
          key={item.inventoryId}
          className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <TriangleAlert className="size-4 shrink-0 text-accent-amber" />
            <span className="truncate font-medium">{item.productName}</span>
          </div>
          <span className="shrink-0 text-right">
            <span className="block font-semibold tabular-nums text-accent-amber">
              {formatQuantity(item.quantity, item.unitOfMeasure)}
            </span>
            {/* Bloque 7.29C.1: punto de reorden solo cuando el dato ya
                existe (`LowStockItem.reorderPoint`, puede ser `null`) —
                sin inventar un valor cuando no está configurado. */}
            {item.reorderPoint != null && (
              <span className="block text-xs text-muted-foreground">
                Reorden: {formatQuantity(item.reorderPoint, item.unitOfMeasure)}
              </span>
            )}
          </span>
        </div>
      ))}

      {items.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 self-start"
          onClick={onViewMore}
        >
          Ver más
        </Button>
      )}
    </div>
  )
}
