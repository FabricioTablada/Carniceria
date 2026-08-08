import type { ReactNode } from 'react'
import { Eye, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Can } from '@/components/common/Can'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { PERMISSIONS } from '@/constants/permissions'
import { formatQuantity } from '@/utils/formatQuantity'
import { formatBatchDate, getDaysUntilExpiry } from '../utils/batch.utils'
import { BatchStatusBadge } from './BatchStatusBadge'
import type { Batch } from '../types/batch.types'

interface BatchesTableProps {
  /** Lotes a mostrar. La tabla no obtiene datos por si misma, mismo
   * criterio que `InventoryWasteTable.tsx`. */
  batches: Batch[]
  emptyMessage?: ReactNode
  /** Se dispara al hacer click en una fila / "Ver detalle" — abre el
   * Drawer (`BatchDrawer.tsx`). */
  onViewDetail?: (batch: Batch) => void
  /** Se dispara al elegir "Ajustar / Bloquear" — navega a la pagina de
   * ajuste (`BatchAdjustPage.tsx`). */
  onAdjust?: (batch: Batch) => void
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/batches/components/BatchesTable.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 (estandar Productos/Impuestos/Mermas). Columnas
 * segun lo solicitado (LOTES-04): código, producto, sucursal, cantidades,
 * estado, fechas y proveedor cuando exista. `scrollX` (7 columnas +
 * acciones, mismo motivo que `InventoryWasteTable.tsx`).
 */
export function BatchesTable({
  batches,
  emptyMessage = 'No hay lotes registrados para mostrar.',
  onViewDetail,
  onAdjust,
  selectedIds,
  onSelectionChange,
}: BatchesTableProps) {
  const columns: DataTableColumn<Batch>[] = [
    {
      header: 'Código',
      render: (batch) => batch.code,
      sortValue: (batch) => batch.code,
      className: 'font-mono text-xs font-medium whitespace-nowrap',
    },
    {
      header: 'Producto',
      sortValue: (batch) => batch.product.name,
      render: (batch) => (
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-semibold text-foreground">
            {batch.product.name}
          </p>
          {batch.product.sku && (
            <p className="truncate text-xs text-muted-foreground">{batch.product.sku}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Sucursal',
      render: (batch) => batch.sucursal.name,
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Proveedor',
      render: (batch) => batch.supplier?.name ?? '—',
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Disponible / Inicial',
      render: (batch) =>
        `${formatQuantity(batch.availableQuantity, batch.product.unitOfMeasure)} / ${formatQuantity(batch.initialQuantity, batch.product.unitOfMeasure)}`,
      sortValue: (batch) => batch.availableQuantity,
      className: 'text-right font-semibold tabular-nums whitespace-nowrap',
      headerClassName: 'text-right',
    },
    {
      header: 'Vencimiento',
      render: (batch) => formatBatchDate(batch.expiryDate),
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      // Rediseño de Inventario: "días restantes" — mismo dato
      // (`expiryDate`) que la columna "Vencimiento", solo expresado como
      // cuenta regresiva en vez de fecha. Rojo cuando ya venció o vence
      // hoy/mañana, ámbar dentro de la próxima semana, sin color el resto.
      header: 'Días restantes',
      render: (batch) => {
        const days = getDaysUntilExpiry(batch.expiryDate)
        if (days === null) return '—'
        return (
          <span
            className={cn(
              'font-semibold tabular-nums',
              days <= 1 ? 'text-destructive' : days <= 7 ? 'text-accent-amber' : 'text-muted-foreground',
            )}
          >
            {days < 0 ? `Vencido (${Math.abs(days)}d)` : `${days}d`}
          </span>
        )
      },
      sortValue: (batch) => getDaysUntilExpiry(batch.expiryDate) ?? Number.POSITIVE_INFINITY,
      className: 'whitespace-nowrap',
    },
    {
      header: 'Estado',
      render: (batch) => (
        <BatchStatusBadge status={batch.status} daysUntilExpiry={getDaysUntilExpiry(batch.expiryDate)} />
      ),
      sortValue: (batch) => batch.status,
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (batch) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <RowMenu label={`Acciones para el lote ${batch.code}`}>
            <RowMenuItem icon={Eye} onClick={() => onViewDetail?.(batch)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.BATCHES_ADJUST}>
              <RowMenuItem icon={Lock} onClick={() => onAdjust?.(batch)}>
                Ajustar / Bloquear
              </RowMenuItem>
            </Can>
          </RowMenu>
        </div>
      ),
      className: 'align-middle',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={batches}
      getRowKey={(batch) => batch.id}
      emptyMessage={emptyMessage}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="px-4 py-2.5"
      scrollX
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onRowClick={onViewDetail}
      initialSort={{ header: 'Días restantes', direction: 'asc' }}
    />
  )
}
