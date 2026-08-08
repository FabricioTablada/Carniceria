import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import type { PurchasesReportItem } from '../types/report.types'

interface PurchasesReportTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: PurchasesReportItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-02, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual") — se dispara al
   * hacer clic sobre una fila, para abrir la compra correspondiente
   * (`/purchases/:id`, ruta ya existente). Opcional. */
  onRowClick?: (item: PurchasesReportItem) => void
}

// Mismas etiquetas/variantes ya usadas en PurchasesTable.tsx (features/
// purchases) para el mismo campo `status` — se replican aqui en vez de
// importarlas porque `PurchasesReportItem.status` llega tipado como
// `string` (ver hallazgo en report.types.ts), no como el union
// `PurchaseStatus` de ese otro modulo.
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: 'muted',
  RECEIVED: 'secondary',
  CANCELLED: 'destructive',
}

export function PurchasesReportTable({
  items,
  emptyMessage = 'No hay compras para mostrar.',
  onRowClick,
}: PurchasesReportTableProps) {
  // Pulido de distribución (aprobado): mismo criterio de
  // `SalesReportTable.tsx` — `whitespace-nowrap` en columnas cortas/
  // numéricas, `truncate max-w-*` en texto libre (Proveedor/Usuario),
  // montos alineados a la derecha (antes quedaban a la izquierda, sin
  // alinear con su encabezado).
  const columns: DataTableColumn<PurchasesReportItem>[] = [
    {
      header: 'Documento',
      sortValue: (item) => item.documentNumber ?? '',
      render: (item) => item.documentNumber ?? '—',
      className: 'text-[0.9375rem] font-semibold whitespace-nowrap',
    },
    {
      header: 'Fecha',
      sortValue: (item) => item.purchaseDate,
      render: (item) => {
        // Bloque 7.35: `item.purchaseDate` (fila del reporte) es un
        // instante UTC real, igual que `saleDate` en `SalesReportTable.tsx`
        // — `slice(0, 10)` asumía que ya representaba el día de Costa
        // Rica, mostrando un día adelantado para compras entre 18:00 y
        // 23:59 hora de Costa Rica. Mismo fix ya validado en
        // `SalesReportTable.tsx` (05/08/2026): reutiliza `formatDateTime`.
        return formatDateTime(item.purchaseDate).split(' ')[0]
      },
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Proveedor',
      sortValue: (item) => item.supplier.name,
      render: (item) => item.supplier.name,
      className: 'max-w-[11rem] truncate text-[0.9375rem] font-semibold',
    },
    {
      header: 'Usuario',
      sortValue: (item) => item.user.fullName,
      render: (item) => item.user.fullName,
      className: 'max-w-[9rem] truncate text-muted-foreground',
    },
    {
      header: 'Estado',
      sortValue: (item) => STATUS_LABELS[item.status] ?? item.status,
      render: (item) => (
        <Badge variant={STATUS_VARIANTS[item.status] ?? 'muted'}>
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      ),
      className: 'align-middle whitespace-nowrap',
    },
    {
      header: 'Subtotal',
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.subtotal),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Impuesto',
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.taxTotal),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Total',
      sortValue: (item) => item.total,
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.total),
      className: 'text-right whitespace-nowrap text-base font-semibold tabular-nums text-brand',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowKey={(item) => item.id}
      emptyMessage={emptyMessage}
      initialSort={{ header: 'Fecha', direction: 'desc' }}
      onRowClick={onRowClick}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="py-4"
      scrollX
    />
  )
}
