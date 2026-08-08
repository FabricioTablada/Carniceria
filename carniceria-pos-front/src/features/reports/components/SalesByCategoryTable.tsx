import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import type { SalesByCategoryItem } from '../types/report.types'

interface SalesByCategoryTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: SalesByCategoryItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-04, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
}

export function SalesByCategoryTable({
  items,
  emptyMessage = 'No hay ventas por categoría para mostrar.',
}: SalesByCategoryTableProps) {
  const columns: DataTableColumn<SalesByCategoryItem>[] = [
    {
      header: 'Categoría',
      sortValue: (item) => item.categoryName,
      render: (item) => item.categoryName,
      className: 'max-w-[16rem] truncate text-[0.9375rem] font-semibold',
    },
    {
      header: 'Cantidad vendida',
      sortValue: (item) => item.totalQuantitySold,
      headerClassName: 'text-right',
      render: (item) => item.totalQuantitySold,
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
      getRowKey={(item) => item.categoryId ?? item.categoryName}
      emptyMessage={emptyMessage}
      initialSort={{ header: 'Importe vendido', direction: 'desc' }}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="py-4"
    />
  )
}