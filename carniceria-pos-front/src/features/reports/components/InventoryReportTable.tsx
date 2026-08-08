import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatQuantity } from '@/utils/formatQuantity'
import type { InventoryReportItem } from '../types/report.types'

interface InventoryReportTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: InventoryReportItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-02, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual") — se dispara al
   * hacer clic sobre una fila, para abrir el producto correspondiente
   * (`/products/:id/edit`, ruta ya existente). Opcional. */
  onRowClick?: (item: InventoryReportItem) => void
}

export function InventoryReportTable({
  items,
  emptyMessage = 'No hay existencias para mostrar.',
  onRowClick,
}: InventoryReportTableProps) {
  // Pulido de distribución (aprobado): "Cantidad"/"Punto de reorden" con
  // `whitespace-nowrap` y alineados a la derecha (montos/cantidades,
  // antes a la izquierda); "Producto" acotado con `truncate` para no
  // competir por espacio con las columnas numéricas.
  const columns: DataTableColumn<InventoryReportItem>[] = [
    {
      header: 'Producto',
      sortValue: (item) => item.product.name,
      render: (item) => item.product.name,
      className: 'max-w-[16rem] truncate text-[0.9375rem] font-semibold',
    },
    {
      header: 'SKU',
      sortValue: (item) => item.product.sku ?? '',
      render: (item) => item.product.sku ?? '—',
      className: 'whitespace-nowrap text-muted-foreground',
    },
    {
      header: 'Sucursal',
      sortValue: (item) => item.sucursal.name,
      render: (item) => item.sucursal.name,
      className: 'max-w-[10rem] truncate text-muted-foreground',
    },
    {
      header: 'Cantidad',
      sortValue: (item) => item.quantity,
      headerClassName: 'text-right',
      render: (item) => formatQuantity(item.quantity, item.product.unitOfMeasure),
      className: 'text-right whitespace-nowrap text-base font-semibold tabular-nums text-brand',
    },
    {
      header: 'Punto de reorden',
      sortValue: (item) => item.reorderPoint ?? -1,
      headerClassName: 'text-right',
      render: (item) =>
        item.reorderPoint !== null
          ? formatQuantity(item.reorderPoint, item.product.unitOfMeasure)
          : '—',
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowKey={(item) => item.id}
      emptyMessage={emptyMessage}
      initialSort={{ header: 'Producto', direction: 'asc' }}
      onRowClick={onRowClick}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="py-4"
    />
  )
}
