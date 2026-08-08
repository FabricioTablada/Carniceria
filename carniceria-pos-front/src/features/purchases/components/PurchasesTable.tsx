import type { ReactNode } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatPurchaseDate } from '../utils/purchase.utils'
import { PurchaseStatusBadge } from './PurchaseStatusBadge'
import type { Purchase } from '../types/purchase.types'

interface PurchasesTableProps {
  /** Compras a mostrar. La tabla no obtiene datos por si misma. */
  purchases: Purchase[]
  /** Contenido mostrado cuando `purchases` esta vacio — texto simple o
   * `EmptyState` (mismo criterio que el resto de las tablas del sprint). */
  emptyMessage?: ReactNode
  /** Se dispara al presionar la accion de editar una compra. */
  onEdit?: (purchase: Purchase) => void
  /** Se dispara al presionar la accion de ver el detalle de una compra. */
  onView?: (purchase: Purchase) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (mismo criterio que el resto de las tablas del sprint). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/purchases/components/PurchasesTable.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — adaptación de Compras al estándar de Productos/
 * Categorías/Impuestos/Proveedores/Promociones/Inventario. El badge de
 * estado se centraliza en `PurchaseStatusBadge` (antes duplicado con
 * `PurchaseDetailPage.tsx`). `scrollX` evita que las 9 columnas se
 * recorten en viewports angostos (mismo criterio ya aplicado en
 * `InventoryWasteTable.tsx`).
 *
 * Canvas Workspace (aprobado): `sortValue` en Documento/Fecha/Proveedor/
 * Usuario/Total — mismo estándar de ordenamiento reutilizable del resto
 * del ERP (`ROADMAP.md`, "Estándar de ordenamiento de tablas"). Orden
 * inicial por Fecha descendente (más reciente primero). Acciones rápidas
 * (Ver/Editar) ahora también visibles al pasar el mouse sobre la fila
 * (`opacity-0 group-hover:opacity-100`, mismo patrón ya usado en
 * `InventoryTable.tsx`/`SuppliersTable.tsx`), sin depender únicamente del
 * `RowMenu` para las acciones más usadas.
 */
export function PurchasesTable({
  purchases,
  emptyMessage = 'No hay compras para mostrar.',
  onEdit,
  onView,
  selectedIds,
  onSelectionChange,
}: PurchasesTableProps) {
  // QA Final 1.0 (Bloque 5): `PATCH /purchases/:id` esta restringido a
  // `SystemRole.ADMIN` en el backend (`purchases/routes.ts`, `authorize`,
  // no `authorizePermission` — no existe un codigo de permiso para esto),
  // asi que la accion "Editar" solo se muestra para ese rol, mismo
  // criterio ya usado en `PurchaseDetailPage.tsx`.
  const isAdmin = useAuthStore((state) => state.user?.role) === 'ADMIN'

  const columns: DataTableColumn<Purchase>[] = [
    {
      header: 'Documento',
      sortValue: (purchase) => purchase.documentNumber ?? '',
      render: (purchase) => purchase.documentNumber ?? '—',
      className: 'text-[0.9375rem] font-semibold',
    },
    {
      header: 'Fecha',
      sortValue: (purchase) => new Date(purchase.purchaseDate).getTime(),
      render: (purchase) => formatPurchaseDate(purchase.purchaseDate),
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Proveedor',
      sortValue: (purchase) => purchase.supplier.name,
      render: (purchase) => purchase.supplier.name,
      className: 'text-muted-foreground',
    },
    {
      header: 'Usuario',
      sortValue: (purchase) => purchase.user.fullName,
      render: (purchase) => purchase.user.fullName,
      className: 'text-muted-foreground',
    },
    {
      header: 'Estado',
      sortValue: (purchase) => purchase.status,
      render: (purchase) => (
        <PurchaseStatusBadge
          status={purchase.status}
          className="w-28 min-w-28 justify-center gap-1.5 py-1"
        />
      ),
      className: 'align-middle',
    },
    {
      header: 'Subtotal',
      render: (purchase) => formatCurrency(purchase.subtotal),
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Impuesto',
      render: (purchase) => formatCurrency(purchase.taxTotal),
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Total',
      sortValue: (purchase) => purchase.total,
      render: (purchase) => formatCurrency(purchase.total),
      className: 'text-base font-bold tabular-nums text-brand',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (purchase) => (
        <div
          className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Ver detalle de ${purchase.documentNumber ?? purchase.id}`}
            onClick={() => onView?.(purchase)}
          >
            <Eye className="size-4" />
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar ${purchase.documentNumber ?? purchase.id}`}
              onClick={() => onEdit?.(purchase)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <RowMenu label={`Más acciones para ${purchase.documentNumber ?? purchase.id}`}>
            <RowMenuItem icon={Eye} onClick={() => onView?.(purchase)}>
              Ver detalle
            </RowMenuItem>
            {isAdmin && (
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(purchase)}>
                Editar
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
      data={purchases}
      getRowKey={(purchase) => purchase.id}
      emptyMessage={emptyMessage}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
      rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="px-4 py-2.5"
      scrollX
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onRowClick={onView}
      initialSort={{ header: 'Fecha', direction: 'desc' }}
    />
  )
}