import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Copy, Eye, Mail, Pencil, Trash2, UserRound } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { useDeleteCustomer } from '../hooks/useDeleteCustomer'
import { getCustomerErrorMessage } from '../utils/customerErrors'
import type { Customer } from '../types/customer.types'

interface CustomersTableProps {
  /** Clientes a mostrar. La tabla no obtiene datos por si misma. */
  customers: Customer[]
  /** Contenido mostrado cuando `customers` esta vacio. */
  emptyMessage?: ReactNode
  /** Se dispara al hacer click sobre una fila — abre el Drawer de vista rapida. */
  onRowClick?: (customer: Customer) => void
  /** Se dispara al presionar la accion de editar un cliente. */
  onEdit?: (customer: Customer) => void
  /** Se dispara al confirmar la accion de activar/desactivar un cliente. */
  onToggleStatus?: (customer: Customer) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de checkboxes. */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/customers/components/CustomersTable.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — mismo patron exacto que `SuppliersTable.tsx`: "Cliente"
 * fusiona nombre + identificación (`tipo número`, subtexto `font-mono`,
 * icono `UserRound` neutro); "Contacto" fusiona correo + teléfono; "Estado"
 * usa el mismo Switch+chip; "Acciones" mismo `RowMenu`
 * (Ver detalle/Editar/Copiar identificación/Eliminar, gated por
 * `CUSTOMERS_DELETE`).
 */
export function CustomersTable({
  customers,
  emptyMessage = 'No hay clientes para mostrar.',
  onRowClick,
  onEdit,
  onToggleStatus,
  selectedIds,
  onSelectionChange,
}: CustomersTableProps) {
  const [pendingToggle, setPendingToggle] = useState<Customer | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null)
  const { mutate: deleteCustomer, isPending: isDeleting } = useDeleteCustomer()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission(PERMISSIONS.CUSTOMERS_UPDATE)

  const handleToggleStatusClick = (customer: Customer) => {
    setPendingToggle(customer)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const handleDeleteClick = (customer: Customer) => {
    setPendingDelete(customer)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deleteCustomer(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Cliente "${pendingDelete.name}" eliminado correctamente.`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getCustomerErrorMessage(error))
      },
    })
  }

  const handleCopyIdentification = (customer: Customer) => {
    navigator.clipboard.writeText(customer.identificationNumber)
    toast.success('Identificación copiada al portapapeles.')
  }

  const columns: DataTableColumn<Customer>[] = [
    {
      header: 'Cliente',
      sortValue: (customer) => customer.name,
      render: (customer) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-foreground">
              {customer.name}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {customer.identificationType} {customer.identificationNumber}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Contacto',
      sortValue: (customer) => customer.email ?? '',
      render: (customer) => (
        <div className="min-w-0">
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              title={customer.email}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1.5 truncate text-brand hover:underline"
            >
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {customer.phone && (
            <p className="truncate text-xs text-muted-foreground">{customer.phone}</p>
          )}
        </div>
      ),
      className: 'max-w-[240px] text-muted-foreground',
    },
    {
      header: 'Estado',
      sortValue: (customer) => (customer.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (customer) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              customer.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={customer.active}
              disabled={!canUpdate}
              title={!canUpdate ? 'No tenés permiso para cambiar el estado de un cliente.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(customer)}
              aria-label={customer.active ? `Desactivar ${customer.name}` : `Activar ${customer.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn(
                'text-sm font-medium',
                customer.active ? 'text-success' : 'text-destructive',
              )}
            >
              {customer.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (customer) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(customer)}
              aria-label={`Ver detalle de ${customer.name}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <Can permission={PERMISSIONS.CUSTOMERS_UPDATE}>
              <button
                type="button"
                onClick={() => onEdit?.(customer)}
                aria-label={`Editar ${customer.name}`}
                title="Editar"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </Can>
          </div>
          <RowMenu label={`Acciones para ${customer.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(customer)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.CUSTOMERS_UPDATE}>
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(customer)}>
                Editar
              </RowMenuItem>
            </Can>
            <RowMenuItem icon={Copy} onClick={() => handleCopyIdentification(customer)}>
              Copiar identificación
            </RowMenuItem>
            <Can permission={PERMISSIONS.CUSTOMERS_DELETE}>
              <RowMenuItem icon={Trash2} destructive onClick={() => handleDeleteClick(customer)}>
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
        data={customers}
        getRowKey={(customer) => customer.id}
        emptyMessage={emptyMessage}
        tableClassName="rounded-none border-0 shadow-none"
        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
        cellClassName="px-4 py-2.5"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        initialSort={{ header: 'Cliente', direction: 'asc' }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar cliente' : 'Activar cliente'}
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
        title="Eliminar cliente"
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
