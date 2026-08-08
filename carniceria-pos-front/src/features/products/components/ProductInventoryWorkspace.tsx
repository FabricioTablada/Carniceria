import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Boxes, Layers3, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StockStatusBadge } from '@/components/common/StockStatusBadge'
import { resolveStockStatus } from '@/utils/stockStatus'
import { formatQuantity } from '@/utils/formatQuantity'
import { useInventory } from '@/features/inventory/hooks/useInventory'
import { useBatches } from '@/features/batches/hooks/useBatches'
import type { UnitOfMeasure } from '../types/product.types'

const STOCK_STATUS_LABELS: Record<'critical' | 'low' | 'optimal', string> = {
  critical: 'Crítico',
  low: 'Bajo',
  optimal: 'Normal',
}

interface ProductInventoryWorkspaceProps {
  /** Solo existe en edición — un producto que todavía no se guardó no
   * tiene existencia de inventario ni lotes que consultar. */
  productId: string
  unitOfMeasure: UnitOfMeasure
}

/**
 * features/products/components/ProductInventoryWorkspace.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Productos — contenido de la pestaña "Inventario y
 * trazabilidad": stock real, punto de reorden y estado (reutilizando
 * `useInventory({ productId })`, `StockStatusBadge`/`resolveStockStatus` ya
 * compartidos con `InventoryPage.tsx`, sin ninguna lógica nueva) + lotes
 * activos (`useBatches({ productId })`, filtro real del backend) + accesos
 * directos a Inventario/Lotes (mismas rutas ya existentes,
 * `/inventory`/`/inventory/batches`, con `productId` preseleccionado).
 *
 * Sin endpoint nuevo, sin cálculo nuevo: todo dato ya existe y ya se
 * consulta en otro módulo — acá solo se cruza por producto.
 */
export function ProductInventoryWorkspace({ productId, unitOfMeasure }: ProductInventoryWorkspaceProps) {
  const navigate = useNavigate()

  const { data: inventoryResponse, isLoading: isLoadingInventory } = useInventory({
    productId,
    limit: 50,
  })
  const inventoryRows = inventoryResponse?.data ?? []
  const totalStock = inventoryRows.reduce((sum, row) => sum + row.quantity, 0)
  // Punto de reorden: el mas bajo entre las sucursales con uno configurado
  // (el mas conservador) — `null` si ninguna sucursal lo tiene.
  const reorderPoints = inventoryRows
    .map((row) => row.reorderPoint)
    .filter((value): value is number => value !== null)
  const reorderPoint = reorderPoints.length > 0 ? Math.min(...reorderPoints) : null
  const stockStatus = resolveStockStatus(totalStock, reorderPoint)

  const { data: batches, isLoading: isLoadingBatches } = useBatches({ productId, limit: 50 })
  const activeBatches = (batches?.data ?? []).filter((batch) => batch.status === 'ACTIVE')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 @sm/inventory-workspace:grid-cols-3">
        <div className="rounded-lg border border-input bg-card p-3.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Stock actual</p>
          {isLoadingInventory ? (
            <p className="mt-1 text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="mt-1 text-xl">
              <StockStatusBadge quantity={totalStock} unitOfMeasure={unitOfMeasure} reorderPoint={reorderPoint} />
            </div>
          )}
        </div>
        <div className="rounded-lg border border-input bg-card p-3.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Punto de reorden</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {reorderPoint !== null ? formatQuantity(reorderPoint, unitOfMeasure) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-input bg-card p-3.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estado del stock</p>
          <p className="mt-1 text-xl font-bold">{stockStatus ? STOCK_STATUS_LABELS[stockStatus] : '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/inventory?productId=${productId}`)}
          className="gap-2"
        >
          <Boxes className="size-4" />
          Ver en Inventario
          <ArrowUpRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/inventory/batches?productId=${productId}`)}
          className="gap-2"
        >
          <Layers3 className="size-4" />
          Ver lotes
          <ArrowUpRight className="size-3.5" />
        </Button>
        {inventoryRows[0] && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/inventory/${inventoryRows[0].id}/adjust`)}
            className="gap-2"
          >
            <SlidersHorizontal className="size-4" />
            Ajustar inventario
            <ArrowUpRight className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-input bg-card p-3.5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Lotes activos {activeBatches.length > 0 ? `(${activeBatches.length})` : ''}
        </p>
        {isLoadingBatches && <p className="text-sm text-muted-foreground">Cargando lotes...</p>}
        {!isLoadingBatches && activeBatches.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin lotes activos para este producto.</p>
        )}
        {!isLoadingBatches && activeBatches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeBatches.map((batch) => (
              <span
                key={batch.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-info/10 px-2.5 py-1 font-mono text-xs font-semibold text-info"
              >
                {batch.code} · {formatQuantity(batch.availableQuantity, unitOfMeasure)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
