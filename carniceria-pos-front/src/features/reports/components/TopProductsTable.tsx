import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatQuantity } from '@/utils/formatQuantity'
import type { TopProductItem } from '../types/report.types'

interface TopProductsTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: TopProductItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-04, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual") — se dispara al
   * hacer clic sobre una fila, para abrir el producto correspondiente
   * (`/products/:id/edit`, ruta ya existente). Opcional. */
  onRowClick?: (item: TopProductItem) => void
}

export function TopProductsTable({
  items,
  emptyMessage = 'No hay productos vendidos para mostrar.',
  onRowClick,
}: TopProductsTableProps) {
  const columns: DataTableColumn<TopProductItem>[] = [
    {
      header: 'Producto',
      sortValue: (item) => item.name,
      render: (item) => item.name,
      className: 'max-w-[16rem] truncate text-[0.9375rem] font-semibold',
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
      className: 'max-w-[9rem] truncate text-muted-foreground',
    },
    {
      header: 'Cantidad vendida',
      sortValue: (item) => item.totalQuantitySold,
      headerClassName: 'text-right',
      render: (item) => formatQuantity(item.totalQuantitySold, item.unitOfMeasure),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Importe vendido',
      sortValue: (item) => item.totalSalesAmount,
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.totalSalesAmount),
      className: 'text-right whitespace-nowrap text-base font-semibold tabular-nums text-brand',
    },
    {
      header: 'Ventas',
      sortValue: (item) => item.salesCount,
      headerClassName: 'text-right',
      render: (item) => item.salesCount,
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowKey={(item) => item.productId}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="py-4"
    />
  )
}
