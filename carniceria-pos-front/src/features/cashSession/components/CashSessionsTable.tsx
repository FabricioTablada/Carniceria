import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { getArqueoResult } from '../utils/cashSessionInsights'
import type { CashReportItem } from '@/features/reports/types/report.types'

interface CashSessionsTableProps {
  sessions: CashReportItem[]
  emptyMessage?: ReactNode
  onRowClick?: (session: CashReportItem) => void
}

/**
 * features/cashSession/components/CashSessionsTable.tsx
 * -----------------------------------------------------------------------------
 * Wireframe aprobado "Caja — Centro de Control": tabla de sesiones de la
 * página principal, reemplaza a la grilla de tarjetas (`CashSessionCard.tsx`,
 * retirada) que antes vivía en Reportes — mismo `DataTable` estándar que el
 * resto del ERP, con `sortValue` en todas las columnas ordenables. Consume
 * `CashReportItem` (tipo ya existente de `useCashReport`, sin ningún dato
 * nuevo del backend).
 *
 * La sesión abierta se resalta con `rowClassName` (fondo `bg-brand/5`) en
 * vez de vivir en una pantalla aparte — se identifica de un vistazo sin
 * tener que leer la columna Estado.
 */
export function CashSessionsTable({
  sessions,
  emptyMessage = 'No hay sesiones de caja para mostrar.',
  onRowClick,
}: CashSessionsTableProps) {
  const columns: DataTableColumn<CashReportItem>[] = [
    {
      header: 'Caja',
      render: (session) => session.cashRegister.name,
      sortValue: (session) => session.cashRegister.name,
      className: 'font-medium',
    },
    {
      header: 'Sucursal',
      render: (session) => session.sucursal.name,
      sortValue: (session) => session.sucursal.name,
      className: 'max-w-[10rem] truncate text-muted-foreground',
    },
    {
      header: 'Cajero',
      render: (session) => session.openedBy.fullName,
      sortValue: (session) => session.openedBy.fullName,
      className: 'max-w-[10rem] truncate text-muted-foreground',
    },
    {
      header: 'Apertura',
      render: (session) => formatDateTime(session.openedAt),
      sortValue: (session) => new Date(session.openedAt).getTime(),
      className: 'whitespace-nowrap tabular-nums text-muted-foreground',
    },
    {
      header: 'Cierre',
      render: (session) => (session.closedAt ? formatDateTime(session.closedAt) : '—'),
      sortValue: (session) => (session.closedAt ? new Date(session.closedAt).getTime() : 0),
      className: 'whitespace-nowrap tabular-nums text-muted-foreground',
    },
    {
      header: 'Ventas',
      render: (session) => session.salesCount,
      sortValue: (session) => session.salesCount,
      className: 'text-right whitespace-nowrap tabular-nums text-muted-foreground',
      headerClassName: 'text-right',
    },
    {
      header: 'Total',
      render: (session) => formatCurrency(session.salesTotal),
      sortValue: (session) => session.salesTotal,
      className: 'text-right whitespace-nowrap font-semibold tabular-nums',
      headerClassName: 'text-right',
    },
    {
      header: 'Diferencia',
      render: (session) =>
        session.difference === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={
              session.difference === 0
                ? 'text-success'
                : session.difference > 0
                  ? 'text-info'
                  : 'text-destructive'
            }
          >
            {session.difference > 0 ? '+' : ''}
            {formatCurrency(session.difference)}
          </span>
        ),
      sortValue: (session) => session.difference ?? 0,
      className: 'text-right whitespace-nowrap tabular-nums font-semibold',
      headerClassName: 'text-right',
    },
    {
      // Mejoras UX de Caja (aprobado, "indicadores visuales reutilizando
      // los badges existentes"): mismo `Badge` de siempre, ahora con un
      // punto de color (`bg-current`, hereda el color del propio badge —
      // ningún token nuevo) en TODAS las variantes, no solo "Abierta"
      // — lectura más rápida de un vistazo, sin agregar ningún estado
      // nuevo (`getArqueoResult`, compartido con el Hero del Drawer).
      header: 'Estado',
      render: (session) => {
        if (session.status === 'OPEN') {
          return (
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-current" />
              Abierta
            </Badge>
          )
        }
        const result = getArqueoResult(session.difference)
        return (
          <Badge variant={result.variant} className="gap-1.5">
            <span className="size-1.5 rounded-full bg-current" />
            {result.label}
          </Badge>
        )
      },
      sortValue: (session) => session.status,
    },
    {
      header: '',
      render: () => <ChevronRight className="size-4 text-muted-foreground/50" />,
      className: 'w-8',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={sessions}
      getRowKey={(session) => session.id}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowClassName={(session) => (session.status === 'OPEN' ? 'bg-brand/5' : '')}
      scrollX
      initialSort={{ header: 'Apertura', direction: 'desc' }}
    />
  )
}
