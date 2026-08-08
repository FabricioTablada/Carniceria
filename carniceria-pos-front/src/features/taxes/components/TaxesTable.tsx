import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Copy, Eye, Pencil, Percent, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { useDeleteTax } from '../hooks/useDeleteTax'
import { getTaxErrorMessage } from '../utils/taxErrors'
import type { Tax } from '../types/tax.types'

interface TaxesTableProps {
  /** Impuestos a mostrar. La tabla no obtiene datos por si misma. */
  taxes: Tax[]
  /** Contenido mostrado cuando `taxes` esta vacio — texto simple o
   * `EmptyState` (mismo criterio que `ProductsTable.tsx`/`CategoriesTable.tsx`). */
  emptyMessage?: ReactNode
  /** Se dispara al hacer click sobre una fila — abre el Drawer de vista
   * rapida (`TaxDrawer.tsx`). */
  onRowClick?: (tax: Tax) => void
  /** Se dispara al presionar la accion de editar un impuesto. */
  onEdit?: (tax: Tax) => void
  /** Se dispara al confirmar la accion de activar/desactivar un impuesto. */
  onToggleStatus?: (tax: Tax) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (mismo criterio que `ProductsTable.tsx`). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/taxes/components/TaxesTable.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias sobre las
 * mismas capacidades aditivas de `DataTable.tsx` (`selectable`,
 * `onRowClick`, foco por teclado) — ninguna otra tabla del proyecto pasa
 * estas props, asi que ninguna cambia.
 *
 * Workspace Impuestos (aprobado, "mismo nivel de calidad que Productos/
 * Categorías"):
 * - "Por defecto" deja de ser una columna propia (casi siempre "—") — se
 *   pliega como chip ★ junto al nombre, en la celda "Nombre" — una
 *   columna menos, mas ancho real para "Tasa" (el dato que si varia por
 *   fila). Sin dato nuevo: sigue siendo `tax.isDefault`.
 * - "Estado" reemplaza el badge de solo lectura por el mismo patron
 *   Switch+chip de `ProductsTable.tsx`/`CategoriesTable.tsx`
 *   (`bg-success/8`/`bg-destructive/8`,
 *   `data-[checked]:bg-success data-[unchecked]:bg-destructive`, mismo
 *   `min-w-[9.5rem]`) — mismo comportamiento (abre el mismo
 *   `ConfirmDialog` de siempre). El item "Activar/Desactivar" del
 *   `RowMenu` se retira: quedaria duplicado con el Switch, mismo
 *   criterio ya aplicado en Productos/Categorías.
 * - "Acciones" gana los mismos iconos de acceso rapido al pasar el
 *   cursor (`group-hover`, Ver detalle/Editar) que ya tiene Productos/
 *   Categorías, ademas del menu "...".
 * - `tableClassName` sin borde/sombra propios — el Workspace unico de
 *   `TaxesPage.tsx` los aporta.
 *
 * "Nombre" fusiona el código como subtexto `font-mono` (mismo patron que
 * la columna "Producto" de Productos: identidad + subtexto) — icono
 * `Percent` neutro (tono de marca), sin color por id: a diferencia de
 * Categorias, un impuesto no se "agrupa" visualmente, asi que no aplica
 * el sistema de color de `CategoryBadge`.
 *
 * `RowMenu`: "Ver detalle" (abre el Drawer), "Editar", "Copiar código"
 * (`navigator.clipboard`, mismo patron que "Copiar SKU" de Productos),
 * "Eliminar". Sin "Marcar como predeterminado" — aprobado explicitamente
 * fuera de este bloque (cambia comportamiento funcional). Encabezado de
 * acciones `sr-only` — mismo criterio que Productos/Categorias.
 *
 * "Eliminar" (bloque de borrado logico, mismo patron ya aprobado en
 * `features/categories/components/CategoriesTable.tsx`): a diferencia de
 * "Activar/Desactivar" (mutacion propiedad de `TaxesPage.tsx`, sin
 * feedback de exito/error), esta tabla llama a `useDeleteTax()`
 * directamente. El dialogo de confirmacion permanece abierto con
 * `loading` mientras la mutacion esta en curso, se cierra solo al tener
 * exito, y el error (p.ej. "tiene productos asociados", 409 del backend)
 * se traduce con `getTaxErrorMessage` y se muestra en un `toast.error`
 * sin cerrar el dialogo — el usuario puede reintentar o cancelar. Gated
 * por `<Can permission={PERMISSIONS.TAXES_DELETE}>`: el backend ya
 * rechaza la peticion sin ese permiso (`taxes.delete` en
 * `authorizePermission`), este `<Can>` solo oculta la opcion en la UI.
 *
 * Estandar de ordenamiento de tablas (ver `ROADMAP.md`): "Nombre"/
 * "Tasa"/"Estado" declaran `column.sortValue` — el comportamiento visual
 * (▲/▼) y la logica de orden viven enteramente en `DataTable.tsx`, sin
 * duplicarse aca. Orden inicial: Nombre A→Z.
 */
export function TaxesTable({
  taxes,
  emptyMessage = 'No hay impuestos para mostrar.',
  onRowClick,
  onEdit,
  onToggleStatus,
  selectedIds,
  onSelectionChange,
}: TaxesTableProps) {
  const [pendingToggle, setPendingToggle] = useState<Tax | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tax | null>(null)
  const { mutate: deleteTax, isPending: isDeleting } = useDeleteTax()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission(PERMISSIONS.TAXES_UPDATE)

  const handleToggleStatusClick = (tax: Tax) => {
    setPendingToggle(tax)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Código copiado al portapapeles.')
  }

  const handleDeleteClick = (tax: Tax) => {
    setPendingDelete(tax)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deleteTax(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Impuesto "${pendingDelete.name}" eliminado correctamente.`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getTaxErrorMessage(error))
      },
    })
  }

  const columns: DataTableColumn<Tax>[] = [
    {
      header: 'Nombre',
      sortValue: (tax) => tax.name,
      render: (tax) => (
        <div className="flex items-center gap-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Percent className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[0.9375rem] font-semibold text-foreground">
              <span className="truncate">{tax.name}</span>
              {tax.isDefault && (
                <Badge variant="accent" className="shrink-0 gap-1 font-bold">
                  <Star className="size-2.5" />
                  Por defecto
                </Badge>
              )}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{tax.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Tasa',
      sortValue: (tax) => tax.rate,
      render: (tax) => `${tax.rate}%`,
      className: 'text-right tabular-nums font-semibold text-foreground',
      headerClassName: 'text-right',
    },
    {
      header: 'Estado',
      sortValue: (tax) => (tax.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (tax) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              tax.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={tax.active}
              disabled={!canUpdate}
              title={!canUpdate ? 'No tenés permiso para cambiar el estado de un impuesto.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(tax)}
              aria-label={tax.active ? `Desactivar ${tax.name}` : `Activar ${tax.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn(
                'text-sm font-medium',
                tax.active ? 'text-success' : 'text-destructive',
              )}
            >
              {tax.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (tax) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(tax)}
              aria-label={`Ver detalle de ${tax.name}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <Can permission={PERMISSIONS.TAXES_UPDATE}>
              <button
                type="button"
                onClick={() => onEdit?.(tax)}
                aria-label={`Editar ${tax.name}`}
                title="Editar"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </Can>
          </div>
          <RowMenu label={`Acciones para ${tax.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(tax)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.TAXES_UPDATE}>
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(tax)}>
                Editar
              </RowMenuItem>
            </Can>
            <RowMenuItem icon={Copy} onClick={() => handleCopyCode(tax.code)}>
              Copiar código
            </RowMenuItem>
            <Can permission={PERMISSIONS.TAXES_DELETE}>
              <RowMenuItem
                icon={Trash2}
                destructive
                onClick={() => handleDeleteClick(tax)}
              >
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
        data={taxes}
        getRowKey={(tax) => tax.id}
        emptyMessage={emptyMessage}
        tableClassName="rounded-none border-0 shadow-none"
        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        // Rediseño de Impuestos (aprobado): "resaltar ligeramente la fila
        // correspondiente" al impuesto por defecto — mismo dato
        // (`tax.isDefault`) que ya pinta el chip de esta misma fila, sin
        // ningún cálculo nuevo.
        rowClassName={(tax) =>
          cn(
            'group transition-colors duration-200 ease-out hover:bg-brand/5',
            tax.isDefault && 'bg-brand/[0.03]',
          )
        }
        cellClassName="px-4 py-2.5"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        initialSort={{ header: 'Nombre', direction: 'asc' }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar impuesto' : 'Activar impuesto'}
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
        title="Eliminar impuesto"
        description={
          pendingDelete
            ? `¿Seguro que querés eliminar "${pendingDelete.name}"? Esta acción no se puede deshacer desde esta pantalla.`
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
