import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatQuantity } from '@/utils/formatQuantity'
import type { LowStockItem } from '../types/report.types'

interface LowStockTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: LowStockItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-04, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual") — se dispara al
   * hacer clic sobre una fila, para abrir el producto correspondiente
   * (`/products/:id/edit`, ruta ya existente). Opcional. */
  onRowClick?: (item: LowStockItem) => void
}

export function LowStockTable({
  items,
  emptyMessage = 'No hay productos con bajo inventario para mostrar.',
  onRowClick,
}: LowStockTableProps) {
  const columns: DataTableColumn<LowStockItem>[] = [
    {
      header: 'Producto',
      sortValue: (item) => item.productName,
      render: (item) => item.productName,
      className: 'max-w-[14rem] truncate text-[0.9375rem] font-semibold',
    },
    {
      header: 'SKU',
      sortValue: (item) => item.sku ?? '',
      render: (item) => item.sku ?? '—',
      className: 'whitespace-nowrap text-muted-foreground',
    },
    {
      header: 'Categoría',
      sortValue: (item) => item.categoryName ?? '',
      render: (item) => item.categoryName ?? '—',
      className: 'max-w-[8rem] truncate text-muted-foreground',
    },
    {
      header: 'Sucursal',
      sortValue: (item) => item.sucursalName,
      render: (item) => item.sucursalName,
      className: 'max-w-[8rem] truncate text-muted-foreground',
    },
    {
      header: 'Cantidad',
      sortValue: (item) => item.quantity,
      headerClassName: 'text-right',
      render: (item) => formatQuantity(item.quantity, item.unitOfMeasure),
      className: 'text-right whitespace-nowrap text-base font-semibold tabular-nums text-accent-amber',
    },
    {
      header: 'Punto de reorden',
      sortValue: (item) => item.reorderPoint ?? -1,
      headerClassName: 'text-right',
      render: (item) =>
        item.reorderPoint !== null
          ? formatQuantity(item.reorderPoint, item.unitOfMeasure)
          : '—',
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Punto de corte usado',
      headerClassName: 'text-right',
      render: (item) =>
        item.thresholdUsed !== null
          ? formatQuantity(item.thresholdUsed, item.unitOfMeasure)
          : '—',
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowKey={(item) => item.inventoryId}
      emptyMessage={emptyMessage}
      initialSort={{ header: 'Cantidad', direction: 'asc' }}
      onRowClick={onRowClick}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      // Centro de Análisis (aprobado, "identificar lo más urgente de un
      // vistazo"): fila completa tintada cuando la existencia es 0 — mismo
      // criterio semántico que `resolveStockStatus`/`StockStatusBadge`
      // (Inventario), sin reutilizar ese componente aquí (no hay Badge de
      // estado en esta tabla) — solo el mismo umbral (`quantity <= 0`).
      rowClassName={(item) =>
        item.quantity <= 0
          ? 'bg-destructive/5 transition-colors duration-200 ease-out hover:bg-destructive/10'
          : 'transition-colors duration-200 ease-out hover:bg-brand/5'
      }
      cellClassName="py-4"
    />
  )
}
