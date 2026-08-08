import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Building2, Copy, Eye, Mail, Pencil, Trash2 } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { useDeleteSupplier } from '../hooks/useDeleteSupplier'
import { getSupplierErrorMessage } from '../utils/supplierErrors'
import type { Supplier } from '../types/supplier.types'

interface SuppliersTableProps {
  /** Proveedores a mostrar. La tabla no obtiene datos por si misma. */
  suppliers: Supplier[]
  /** Contenido mostrado cuando `suppliers` esta vacio — texto simple o
   * `EmptyState` (mismo criterio que el resto de las tablas del sprint). */
  emptyMessage?: ReactNode
  /** Se dispara al hacer click sobre una fila — abre el Drawer de vista
   * rapida (`SupplierDrawer.tsx`). */
  onRowClick?: (supplier: Supplier) => void
  /** Se dispara al presionar la accion de editar un proveedor. */
  onEdit?: (supplier: Supplier) => void
  /** Se dispara al confirmar la accion de activar/desactivar un proveedor. */
  onToggleStatus?: (supplier: Supplier) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (mismo criterio que el resto de las tablas del sprint). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/suppliers/components/SuppliersTable.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias/Impuestos/
 * Promociones sobre las mismas capacidades aditivas de `DataTable.tsx`
 * (`selectable`, `onRowClick`, `column.sortValue`, foco por teclado) —
 * ninguna otra tabla del proyecto pasa estas props, asi que ninguna
 * cambia.
 *
 * "Proveedor" fusiona la identificacion (`legalId`) como subtexto
 * `font-mono` (igual que SKU/codigo en Productos/Impuestos), con icono
 * `Building2` neutro (sin color por id, mismo criterio que Impuestos).
 * "Contacto" fusiona `contactName` + `phone` como subtexto.
 *
 * Workspace Proveedores (aprobado):
 * - "Correo" pasa a ser columna propia (antes solo vivia en el Drawer) —
 *   enlace `mailto:` con icono `Mail`, truncado con `truncate` + `title`
 *   nativo del navegador (tooltip con el valor completo al pasar el
 *   cursor, sin agregar ningun componente de Tooltip nuevo al proyecto).
 * - "Estado" reemplaza el badge de solo lectura por el mismo patron
 *   Switch+chip de `ProductsTable.tsx`/`CategoriesTable.tsx`/
 *   `TaxesTable.tsx`/`PromotionsTable.tsx` — mismo comportamiento (abre
 *   el mismo `ConfirmDialog` de siempre). El item "Activar/Desactivar"
 *   del `RowMenu` se retira: quedaria duplicado con el Switch.
 * - Ordenamiento por columna (Proveedor/Contacto/Correo/Estado) —
 *   reutiliza EXCLUSIVAMENTE `column.sortValue` de `DataTable.tsx` (ver
 *   `ROADMAP.md`, "Estándar de ordenamiento de tablas"), sin logica
 *   propia. Orden inicial: Proveedor A→Z.
 * - `tableClassName` sin borde/sombra propios — el Workspace unico de
 *   `SuppliersPage.tsx` los aporta.
 *
 * `RowMenu`: "Ver detalle", "Editar", "Copiar identificación" (oculto si
 * no hay `legalId`), "Eliminar" — se preserva EXACTAMENTE el flujo de
 * borrado que ya existia (mismo `useDeleteSupplier`, mismo
 * `ConfirmDialog` con `loading={isDeleting}`, mismo texto de
 * confirmacion). Gated por
 * `<Can permission={PERMISSIONS.SUPPLIERS_DELETE}>`: el backend ya lo
 * rechaza sin ese permiso, este `<Can>` solo oculta la opcion en la UI.
 */
export function SuppliersTable({
  suppliers,
  emptyMessage = 'No hay proveedores para mostrar.',
  onRowClick,
  onEdit,
  onToggleStatus,
  selectedIds,
  onSelectionChange,
}: SuppliersTableProps) {
  const [pendingToggle, setPendingToggle] = useState<Supplier | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null)
  const { mutate: deleteSupplier, isPending: isDeleting } = useDeleteSupplier()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission(PERMISSIONS.SUPPLIERS_UPDATE)

  const handleToggleStatusClick = (supplier: Supplier) => {
    setPendingToggle(supplier)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const handleDeleteClick = (supplier: Supplier) => {
    setPendingDelete(supplier)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deleteSupplier(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Proveedor "${pendingDelete.name}" eliminado correctamente.`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getSupplierErrorMessage(error))
      },
    })
  }

  const handleCopyLegalId = (legalId: string) => {
    navigator.clipboard.writeText(legalId)
    toast.success('Identificación copiada al portapapeles.')
  }

  const columns: DataTableColumn<Supplier>[] = [
    {
      header: 'Proveedor',
      sortValue: (supplier) => supplier.name,
      render: (supplier) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-foreground">
              {supplier.name}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {supplier.legalId ?? 'Sin identificación'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Contacto',
      sortValue: (supplier) => supplier.contactName ?? '',
      render: (supplier) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{supplier.contactName ?? '—'}</p>
          {supplier.phone && (
            <p className="truncate text-xs text-muted-foreground">{supplier.phone}</p>
          )}
        </div>
      ),
      className: 'text-muted-foreground',
    },
    {
      header: 'Correo',
      sortValue: (supplier) => supplier.email ?? '',
      render: (supplier) =>
        supplier.email ? (
          <a
            href={`mailto:${supplier.email}`}
            title={supplier.email}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex max-w-full items-center gap-1.5 truncate text-brand hover:underline"
          >
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: 'max-w-[220px]',
    },
    {
      header: 'Estado',
      sortValue: (supplier) => (supplier.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (supplier) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              supplier.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={supplier.active}
              disabled={!canUpdate}
              title={!canUpdate ? 'No tenés permiso para cambiar el estado de un proveedor.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(supplier)}
              aria-label={supplier.active ? `Desactivar ${supplier.name}` : `Activar ${supplier.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn(
                'text-sm font-medium',
                supplier.active ? 'text-success' : 'text-destructive',
              )}
            >
              {supplier.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (supplier) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(supplier)}
              aria-label={`Ver detalle de ${supplier.name}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <Can permission={PERMISSIONS.SUPPLIERS_UPDATE}>
              <button
                type="button"
                onClick={() => onEdit?.(supplier)}
                aria-label={`Editar ${supplier.name}`}
                title="Editar"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </Can>
          </div>
          <RowMenu label={`Acciones para ${supplier.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(supplier)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.SUPPLIERS_UPDATE}>
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(supplier)}>
                Editar
              </RowMenuItem>
            </Can>
            {supplier.legalId && (
              <RowMenuItem icon={Copy} onClick={() => handleCopyLegalId(supplier.legalId as string)}>
                Copiar identificación
              </RowMenuItem>
            )}
            <Can permission={PERMISSIONS.SUPPLIERS_DELETE}>
              <RowMenuItem icon={Trash2} destructive onClick={() => handleDeleteClick(supplier)}>
                Eliminar
              </RowMenuItem>
            </Can>
          </RowMenu>
        </div>
      ),
      className: 'w-24 align-middle',
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={suppliers}
        getRowKey={(supplier) => supplier.id}
        emptyMessage={emptyMessage}
        tableClassName="rounded-none border-0 shadow-none"
        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
        cellClassName="px-4 py-2.5"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        initialSort={{ header: 'Proveedor', direction: 'asc' }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar proveedor' : 'Activar proveedor'}
        description={
          pendingToggle
            ? pendingToggle.active
              ? `¿Seguro que querés desactivar "${pendingToggle.name}"?`
              : `¿Seguro que querés activar "${pendingToggle.name}"?`
            : undefined
        }
        confirmText={pendingToggle?.active ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        onConfirm={handleConfirmToggle}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title="Eliminar proveedor"
        description={
          pendingDelete
            ? `¿Seguro que querés eliminar a "${pendingDelete.name}"? Esta acción no se puede deshacer desde esta pantalla.`
            : undefined
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
