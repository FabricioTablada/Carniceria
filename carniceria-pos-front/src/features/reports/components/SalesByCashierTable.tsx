import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import type { SalesByCashierItem } from '../types/report.types'

interface SalesByCashierTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: SalesByCashierItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-04, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual") — se dispara al
   * hacer clic sobre una fila, para abrir el usuario correspondiente
   * (`/users/:id/edit`, ruta ya existente y ya protegida por
   * `PERMISSIONS.USERS_MANAGE` a nivel de ruta). Quien lo use decide si
   * llamarlo cuando `item.userId` es `null` (cajero eliminado). Opcional. */
  onRowClick?: (item: SalesByCashierItem) => void
}

export function SalesByCashierTable({
  items,
  emptyMessage = 'No hay ventas por cajero para mostrar.',
  onRowClick,
}: SalesByCashierTableProps) {
  const columns: DataTableColumn<SalesByCashierItem>[] = [
    {
      header: 'Cajero',
      sortValue: (item) => item.userName,
      render: (item) => item.userName,
      className: 'max-w-[14rem] truncate text-[0.9375rem] font-semibold',
    },
    {
      header: 'Ventas',
      sortValue: (item) => item.totalSales,
      headerClassName: 'text-right',
      render: (item) => item.totalSales,
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
      header: 'Ticket promedio',
      sortValue: (item) => item.averageTicket,
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.averageTicket),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowKey={(item) => item.userId ?? item.userName}
      emptyMessage={emptyMessage}
      initialSort={{ header: 'Importe vendido', direction: 'desc' }}
      onRowClick={onRowClick}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="py-4"
    />
  )
}