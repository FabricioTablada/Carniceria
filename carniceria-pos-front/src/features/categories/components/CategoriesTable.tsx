import { useState } from 'react'
import { Eye, FolderTree, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { useDeleteCategory } from '../hooks/useDeleteCategory'
import { getCategoryErrorMessage } from '../utils/categoryErrors'
import type { Category } from '../types/category.types'

interface CategoriesTableProps {
  /** Categorias a mostrar. La tabla no obtiene datos por si misma. */
  categories: Category[]
  /** Contenido mostrado cuando `categories` esta vacio — texto simple o
   * `EmptyState` (mismo criterio que `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Se dispara al hacer click sobre una fila — abre el Drawer de vista
   * rapida (`CategoryDrawer.tsx`). */
  onRowClick?: (category: Category) => void
  /** Se dispara al presionar la accion de editar una categoria. */
  onEdit?: (category: Category) => void
  /** Se dispara al confirmar la accion de activar/desactivar una categoria. */
  onToggleStatus?: (category: Category) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (mismo criterio que `ProductsTable.tsx`). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
}

/**
 * features/categories/components/CategoriesTable.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos (`ProductsTable.tsx`) sobre
 * las mismas capacidades aditivas de `DataTable.tsx` (`selectable`,
 * `onRowClick`, `column.headerClassName`, foco por teclado) — ninguna
 * otra tabla del proyecto pasa estas props, asi que ninguna cambia.
 *
 * Workspace Categorías (aprobado): `tableClassName` sin borde/sombra
 * propios (`rounded-none border-0 shadow-none`, mismo valor que ya usa
 * `ProductsTable.tsx`) — el borde exterior lo aporta el Workspace unico
 * de `CategoriesPage.tsx` que la contiene, no la tabla.
 *
 * Pulido visual (aprobado, "mismo nivel de calidad que Productos"):
 * - Franja de color por categoria al borde izquierdo de cada fila
 *   (`w-2 p-0 pl-3`, mismo `getCategoryColor(...).dot` que ya usa
 *   `ProductsTable.tsx` para su propia franja) — misma identidad visual
 *   del catalogo aplicada aca.
 * - "Nombre" gana `max-w-[320px]` (mismo valor exacto que "Producto" en
 *   Productos) para no crecer mas de lo necesario y dejar "aire" vacio
 *   en el medio de la tabla — el mismo sintoma que ya se corrigio ahi.
 * - "Estado" reemplaza el badge de solo lectura por el mismo patron
 *   Switch+chip de `ProductsTable.tsx` (`bg-success/8`/`bg-destructive/8`,
 *   `data-[checked]:bg-success data-[unchecked]:bg-destructive`, mismo
 *   `min-w-[9.5rem]`) — mismo tamaño, mismo color, misma alineacion,
 *   mismo comportamiento (abre el mismo `ConfirmDialog` de siempre, sin
 *   cambiar la mutacion). El item "Activar/Desactivar" del `RowMenu` se
 *   retira: quedaria duplicado con el Switch, mismo criterio ya aplicado
 *   en Productos (el Switch es el UNICO lugar donde se activa/desactiva).
 * - Pulido final (aprobado): franja de color mas fina (`w-1.5`→`w-1`,
 *   detalle exclusivo de esta tabla — Productos no se toca) y `gap-3`→
 *   `gap-3.5` en la celda "Nombre" (mismo gap exacto que "Producto" en
 *   Productos, entre icono y texto). "Categoría padre" ya no muestra un
 *   guion solo para las categorias raiz: usa el mismo texto que ya
 *   muestra `CategoryDrawer.tsx` en ese caso ("Sin categoría padre").
 * - "Acciones" gana los mismos iconos de acceso rapido al pasar el
 *   cursor (`group-hover`, Ver detalle/Editar) que ya tiene Productos,
 *   ademas del menu "...".
 *
 * "Nombre" ahora lleva un icono `FolderTree` tintado con
 * `getCategoryColor(category.id)` (mismo color que se ve en cualquier
 * `CategoryBadge` de esta categoria en otras pantallas) + descripcion
 * truncada debajo. "Categoría padre" usa `CategoryBadge` (la MISMA
 * categoria del padre, coloreada igual que en su propia fila) — sin
 * equivalente en Productos (esta tabla es la unica con jerarquia propia),
 * se mantiene como columna independiente.
 *
 * "Eliminar" (bloque de borrado logico): a diferencia de
 * "Activar/Desactivar" (mutacion propiedad de `CategoriesPage.tsx`, sin
 * feedback de exito/error), esta tabla llama a `useDeleteCategory()`
 * directamente — mismo patron ya establecido en
 * `features/suppliers/components/SuppliersTable.tsx` (unico modulo con
 * borrado ya implementado): dialogo de confirmacion permanece abierto con
 * `loading` mientras la mutacion esta en curso, se cierra solo al tener
 * exito, y el error (p.ej. "tiene productos asociados", 409 del backend)
 * se traduce con `getCategoryErrorMessage` y se muestra en un
 * `toast.error` sin cerrar el dialogo — el usuario puede reintentar o
 * cancelar. Gated por `<Can permission={PERMISSIONS.CATEGORIES_DELETE}>`:
 * el backend ya rechaza la peticion sin ese permiso (`categories.delete`
 * en `authorizePermission`), este `<Can>` solo oculta la opcion en la UI.
 *
 * Estandar de ordenamiento de tablas (ver `ROADMAP.md`): "Nombre"/
 * "Categoría padre"/"Estado" declaran `column.sortValue` — el
 * comportamiento visual (▲/▼) y la logica de orden viven enteramente en
 * `DataTable.tsx`, sin duplicarse aca. Orden inicial: Nombre A→Z.
 */
export function CategoriesTable({
  categories,
  emptyMessage = 'No hay categorías para mostrar.',
  onRowClick,
  onEdit,
  onToggleStatus,
  selectedIds,
  onSelectionChange,
}: CategoriesTableProps) {
  const [pendingToggle, setPendingToggle] = useState<Category | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const { mutate: deleteCategory, isPending: isDeleting } = useDeleteCategory()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission(PERMISSIONS.CATEGORIES_UPDATE)

  const handleToggleStatusClick = (category: Category) => {
    setPendingToggle(category)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const handleDeleteClick = (category: Category) => {
    setPendingDelete(category)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deleteCategory(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Categoría "${pendingDelete.name}" eliminada correctamente.`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getCategoryErrorMessage(error))
      },
    })
  }

  const columns: DataTableColumn<Category>[] = [
    {
      header: '',
      headerClassName: 'sr-only',
      render: (category) => (
        <span
          className="block h-8 w-1 rounded-full"
          style={resolveCategoryColor(category).dot}
          aria-hidden="true"
        />
      ),
      className: 'w-2 p-0 pl-3',
    },
    {
      header: 'Nombre',
      sortValue: (category) => category.name,
      headerClassName: 'max-w-[320px]',
      className: 'max-w-[320px]',
      render: (category) => {
        const color = resolveCategoryColor(category)

        return (
          <div className="flex items-center gap-3.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ ...color.tint, ...color.text }}
            >
              <FolderTree className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-semibold text-foreground">
                {category.name}
              </p>
              {category.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      header: 'Categoría padre',
      sortValue: (category) => category.parent?.name ?? '',
      render: (category) =>
        category.parent ? (
          <CategoryBadge
            categoryId={category.parent.id}
            label={category.parent.name}
            color={category.parent.color}
          />
        ) : (
          <span className="text-sm text-muted-foreground italic">Sin categoría padre</span>
        ),
    },
    {
      header: 'Estado',
      sortValue: (category) => (category.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (category) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              category.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={category.active}
              disabled={!canUpdate}
              title={!canUpdate ? 'No tenés permiso para cambiar el estado de una categoría.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(category)}
              aria-label={category.active ? `Desactivar ${category.name}` : `Activar ${category.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn(
                'text-sm font-medium',
                category.active ? 'text-success' : 'text-destructive',
              )}
            >
              {category.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (category) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(category)}
              aria-label={`Ver detalle de ${category.name}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <Can permission={PERMISSIONS.CATEGORIES_UPDATE}>
              <button
                type="button"
                onClick={() => onEdit?.(category)}
                aria-label={`Editar ${category.name}`}
                title="Editar"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </Can>
          </div>
          <RowMenu label={`Acciones para ${category.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(category)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.CATEGORIES_UPDATE}>
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(category)}>
                Editar
              </RowMenuItem>
            </Can>
            <Can permission={PERMISSIONS.CATEGORIES_DELETE}>
              <RowMenuItem
                icon={Trash2}
                destructive
                onClick={() => handleDeleteClick(category)}
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
        data={categories}
        getRowKey={(category) => category.id}
        emptyMessage={emptyMessage}
        tableClassName="rounded-none border-0 shadow-none"
        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
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
        title={
          pendingToggle?.active ? 'Desactivar categoría' : 'Activar categoría'
        }
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
        title="Eliminar categoría"
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
