import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Eye, Layers3, Pencil, Trash2 } from 'lucide-react'
import { StockStatusBadge } from '@/components/common/StockStatusBadge'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/button'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatQuantity } from '@/utils/formatQuantity'
import { resolveStockStatus } from '@/utils/stockStatus'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import { useProductLastPurchase } from '@/features/purchases/hooks/useProductLastPurchase'
import { useProductLastSale } from '@/features/products/hooks/useProductLastSale'
import { useBatches } from '@/features/batches/hooks/useBatches'
import type { Inventory } from '../types/inventory.types'

/** Rediseño de Inventario: celdas de las columnas opcionales — cada una es
 * su propio componente (no una función de render simple) porque necesita
 * llamar hooks por fila (`useProductLastPurchase`/`useProductLastSale`/
 * `useBatches`, todos ya construidos para Compras/Productos) — mismo
 * patrón ya usado en `PurchaseItemCard.tsx`. */
function LastPurchaseCell({ productId }: { productId: string }) {
  const { data } = useProductLastPurchase(productId)
  if (!data) return <span className="text-muted-foreground">—</span>
  return <span>{formatCurrency(data.lastUnitCost)}</span>
}

function LastSaleCell({ productId, unitOfMeasure }: { productId: string; unitOfMeasure: Inventory['product']['unitOfMeasure'] }) {
  const { data } = useProductLastSale(productId)
  if (!data) return <span className="text-muted-foreground">—</span>
  return <span>{formatQuantity(data.quantity, unitOfMeasure)}</span>
}

function ActiveBatchesCell({ productId }: { productId: string }) {
  const { data } = useBatches({ productId, status: 'ACTIVE', limit: 1 })
  return <span>{data?.meta.total ?? '—'}</span>
}

interface CategoryLookupEntry {
  id: string
  color: string | null
}

interface InventoryTableProps {
  /** Existencias a mostrar. La tabla no obtiene datos por si misma. */
  inventory: Inventory[]
  /** Contenido mostrado cuando `inventory` esta vacio — texto simple o
   * `EmptyState` (mismo criterio que el resto de las tablas del sprint). */
  emptyMessage?: ReactNode
  /** Se dispara al presionar la accion de ajustar/abrir el Drawer de una
   * existencia. */
  onAdjust?: (item: Inventory) => void
  /** Se dispara al presionar la accion de registrar una merma. Opcional —
   * si no se pasa, la opcion no aparece. Gateada por `inventory.waste`. */
  onRegisterWaste?: (item: Inventory) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (mismo criterio que el resto de las tablas del sprint). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
  /** Rediseño de Inventario: columnas opcionales (Última compra/Última
   * venta/Lotes) — apagadas por defecto porque cada una dispara hooks por
   * fila; `InventoryPage.tsx` las activa con un toggle visible. */
  showExtraColumns?: boolean
  /** Centro de Control de Inventario (aprobado): categoría de cada
   * producto (`{id, color}`), indexada por `productId` — para la franja
   * lateral de color. Se arma en `InventoryPage.tsx` cruzando contra
   * `useProducts` (ya se pedía para "Valor total"), sin endpoint nuevo.
   * Ausente/`undefined` para un producto → sin franja (neutro), nunca un
   * color inventado. */
  categoryByProductId?: Map<string, CategoryLookupEntry>
}

/**
 * features/inventory/components/InventoryTable.tsx
 * -----------------------------------------------------------------------------
 * Centro de Control de Inventario (aprobado): franja lateral con el color
 * de categoría (mismo `resolveCategoryColor` ya usado en Productos/
 * Categorías, sin persistencia nueva), columna "Estado" con chip (además
 * de "Cantidad", que sigue con el patrón dot+número), y 3 acciones
 * rápidas SIEMPRE visibles en vez de escondidas detrás de "..." (Abrir
 * Drawer / Registrar merma / Ver lotes) — el `RowMenu` sigue existiendo
 * para acciones menos frecuentes. `sortValue` en Producto/Cantidad/Punto
 * de reorden: mismo estándar de ordenamiento de `DataTable` ya usado en
 * el resto del ERP.
 */
export function InventoryTable({
  inventory,
  emptyMessage = 'No hay existencias para mostrar.',
  onAdjust,
  onRegisterWaste,
  selectedIds,
  onSelectionChange,
  showExtraColumns = false,
  categoryByProductId,
}: InventoryTableProps) {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canRegisterWaste = hasPermission(PERMISSIONS.INVENTORY_WASTE)
  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_ADJUST)

  const handleViewLots = (item: Inventory) => {
    navigate(`/inventory/batches?productId=${item.productId}`)
  }

  const columns: DataTableColumn<Inventory>[] = [
    {
      header: 'Producto',
      sortValue: (item) => item.product.name,
      render: (item) => {
        const category = categoryByProductId?.get(item.productId)
        const stripeStyle = category ? resolveCategoryColor(category).dot : undefined

        return (
          <div className="flex items-center gap-3">
            <span
              className="h-8 w-1 shrink-0 rounded-full bg-border"
              style={stripeStyle}
              aria-hidden="true"
            />
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Boxes className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-semibold text-foreground">
                {item.product.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.product.sku ?? 'Sin SKU'}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      header: 'Sucursal',
      render: (item) => item.sucursal.name,
      className: 'text-muted-foreground',
    },
    {
      header: 'Cantidad',
      sortValue: (item) => item.quantity,
      render: (item) => (
        <StockStatusBadge
          quantity={item.quantity}
          unitOfMeasure={item.product.unitOfMeasure}
          reorderPoint={item.reorderPoint}
        />
      ),
      className: 'text-base',
    },
    {
      header: 'Punto de reorden',
      sortValue: (item) => item.reorderPoint ?? -1,
      render: (item) => item.reorderPoint ?? '—',
      className: 'text-muted-foreground',
    },
    {
      header: 'Estado',
      sortValue: (item) => resolveStockStatus(item.quantity, item.reorderPoint) ?? '',
      render: (item) => (
        <StockStatusBadge
          variant="chip"
          quantity={item.quantity}
          unitOfMeasure={item.product.unitOfMeasure}
          reorderPoint={item.reorderPoint}
        />
      ),
    },
    ...(showExtraColumns
      ? ([
          {
            header: 'Última compra',
            render: (item) => <LastPurchaseCell productId={item.productId} />,
            className: 'text-muted-foreground tabular-nums whitespace-nowrap',
          },
          {
            header: 'Última venta',
            render: (item) => <LastSaleCell productId={item.productId} unitOfMeasure={item.product.unitOfMeasure} />,
            className: 'text-muted-foreground tabular-nums whitespace-nowrap',
          },
          {
            header: 'Lotes activos',
            render: (item) => <ActiveBatchesCell productId={item.productId} />,
            className: 'text-muted-foreground tabular-nums whitespace-nowrap',
          },
        ] satisfies DataTableColumn<Inventory>[])
      : []),
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (item) => (
        <div
          className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {canAdjust && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Abrir detalle de ${item.product.name}`}
              onClick={() => onAdjust?.(item)}
            >
              <Eye className="size-4" />
            </Button>
          )}
          {onRegisterWaste && canRegisterWaste && item.quantity > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Registrar merma de ${item.product.name}`}
              onClick={() => onRegisterWaste(item)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Ver lotes de ${item.product.name}`}
            onClick={() => handleViewLots(item)}
          >
            <Layers3 className="size-4" />
          </Button>
          <RowMenu label={`Más acciones para ${item.product.name}`}>
            {canAdjust && (
              <RowMenuItem icon={Pencil} onClick={() => onAdjust?.(item)}>
                Ajustar existencia
              </RowMenuItem>
            )}
            <RowMenuItem icon={Layers3} onClick={() => handleViewLots(item)}>
              Ver lotes
            </RowMenuItem>
            {onRegisterWaste && canRegisterWaste && item.quantity > 0 && (
              <RowMenuItem icon={Trash2} destructive onClick={() => onRegisterWaste(item)}>
                Registrar merma
              </RowMenuItem>
            )}
          </RowMenu>
        </div>
      ),
      className: 'align-middle',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={inventory}
      getRowKey={(item) => item.id}
      emptyMessage={emptyMessage}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
      rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="px-4 py-2.5"
      scrollX={showExtraColumns}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onRowClick={canAdjust ? onAdjust : undefined}
      initialSort={{ header: 'Producto', direction: 'asc' }}
    />
  )
}
