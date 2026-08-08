import { useState, type ReactNode } from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/common/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { useDeleteInventoryWaste } from '../hooks/useDeleteInventoryWaste'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import type { InventoryWaste } from '../types/inventory.types'

interface InventoryWasteTableProps {
  /** Mermas a mostrar. La tabla no obtiene datos por si misma, mismo
   * criterio que `InventoryTable.tsx`. */
  wastes: InventoryWaste[]
  emptyMessage?: ReactNode
  /** Se dispara al presionar "Ver detalle" de una merma — abre el Drawer
   * (`InventoryWasteDrawer.tsx`). */
  onViewDetail?: (waste: InventoryWaste) => void
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/inventory/components/InventoryWasteTable.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1. El boton-icono suelto de "Ver detalle" se
 * reemplaza por `RowMenu` + `onRowClick` (mismo criterio que
 * Proveedores/Promociones). Se agrega la columna "Valor" (`totalValue`,
 * ya presente en cada registro — sin agregacion nueva, hallazgo del
 * analisis UX). `scrollX` en `DataTable` corrige el desbordamiento
 * horizontal (8 columnas se recortaban en viewports angostos, la columna
 * "Usuario" quedaba invisible).
 *
 * Bloque "Eliminación de Mermas" (aprobado): "Eliminar merma" en el
 * `RowMenu`, gateado por `user?.role === 'ADMIN'` — mismo mecanismo de
 * chequeo por ROL ya usado en `PurchaseDetailPage.tsx`/`UserDrawer.tsx`/
 * `SaleTimeline.tsx` (no `<Can permission>`: esta acción es
 * exclusivamente para Administrador, no un permiso asignable a otros
 * roles). Mismo patrón de `ConfirmDialog` + `pendingDelete` que
 * `SuppliersTable.tsx`.
 */
export function InventoryWasteTable({
  wastes,
  emptyMessage = 'No hay mermas registradas para mostrar.',
  onViewDetail,
  selectedIds,
  onSelectionChange,
}: InventoryWasteTableProps) {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'
  const [pendingDelete, setPendingDelete] = useState<InventoryWaste | null>(null)
  const { mutate: deleteWaste, isPending: isDeleting } = useDeleteInventoryWaste()

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deleteWaste(pendingDelete.id, {
      onSuccess: () => {
        toast.success('Registro de merma eliminado correctamente.')
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(error.message ?? 'Ocurrió un error al eliminar la merma.')
      },
    })
  }

  const columns: DataTableColumn<InventoryWaste>[] = [
    {
      header: 'Fecha',
      sortValue: (waste) => new Date(waste.createdAt).getTime(),
      render: (waste) => formatDateTime(waste.createdAt),
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Producto',
      sortValue: (waste) => waste.product.name,
      render: (waste) => (
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-semibold text-foreground">
            {waste.product.name}
          </p>
          {waste.product.sku && (
            <p className="truncate text-xs text-muted-foreground">{waste.product.sku}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Cantidad',
      sortValue: (waste) => waste.quantity,
      render: (waste) => formatQuantity(waste.quantity, waste.product.unitOfMeasure),
      className: 'text-base font-bold tabular-nums text-destructive whitespace-nowrap',
    },
    {
      header: 'Motivo',
      render: (waste) => (
        <Badge variant="muted">
          {WASTE_REASON_OPTIONS.find((option) => option.value === waste.reason)?.label ??
            waste.reason}
        </Badge>
      ),
    },
    {
      header: 'Origen',
      // `sourceReturnItemId` (no el `reason`) es la unica señal confiable de
      // que esta merma se genero automaticamente desde una devolucion: el
      // registro MANUAL desde Inventario tambien permite elegir el motivo
      // "Devolución no reingresada" sin que exista ninguna devolucion real
      // detras (ver `InventoryWasteForm.tsx`) — mostrar el origen a partir
      // del motivo seria enganoso.
      render: (waste) =>
        waste.sourceReturnItemId ? (
          <Badge variant="accent">Devolución de venta</Badge>
        ) : (
          <Badge variant="muted">Registro manual</Badge>
        ),
    },
    {
      header: 'Usuario',
      render: (waste) => waste.user.fullName,
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Sucursal',
      render: (waste) => waste.sucursal.name,
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      // Hallazgo del analisis UX: el dato ya venia en cada registro
      // (`InventoryWaste.totalValue`) pero la tabla nunca lo mostraba.
      header: 'Valor',
      sortValue: (waste) => waste.totalValue,
      render: (waste) => formatCurrency(waste.totalValue),
      className: 'text-right font-semibold tabular-nums whitespace-nowrap',
      headerClassName: 'text-right',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (waste) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <RowMenu label={`Acciones para la merma de ${waste.product.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onViewDetail?.(waste)}>
              Ver detalle
            </RowMenuItem>
            {isAdmin && (
              <RowMenuItem icon={Trash2} destructive onClick={() => setPendingDelete(waste)}>
                Eliminar merma
              </RowMenuItem>
            )}
          </RowMenu>
        </div>
      ),
      className: 'align-middle',
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={wastes}
        getRowKey={(waste) => waste.id}
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
        initialSort={{ header: 'Fecha', direction: 'desc' }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title="Eliminar registro de merma"
        description="Esta acción eliminará permanentemente este registro de merma. Utilizá esta opción únicamente cuando la merma haya sido registrada por error. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
