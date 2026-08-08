import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { formatCurrency } from '@/utils/formatCurrency'
import { useDeleteProduct } from '../hooks/useDeleteProduct'
import { getProductErrorMessage } from '../utils/productErrors'
import type { Product } from '../types/product.types'

interface ProductsTableProps {
  /** Productos a mostrar. La tabla no obtiene datos por si misma. */
  products: Product[]
  /** Contenido mostrado cuando `products` esta vacio — texto simple o
   * `ProductsEmptyState.tsx` (Bloque 7). */
  emptyMessage?: ReactNode
  /** Se dispara al hacer click sobre una fila — abre el Drawer de vista
   * rapida (`ProductDrawer.tsx`, Bloque 5). */
  onRowClick?: (product: Product) => void
  /** Se dispara al presionar la accion de editar un producto (menu de
   * acciones de la fila). */
  onEdit?: (product: Product) => void
  /** Se dispara al confirmar la accion de activar/desactivar un producto. */
  onToggleStatus?: (product: Product) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (misma tabla que antes de Bloque 4). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
  /** Rediseño de Workspace de Productos (aprobado): `'comfortable'`
   * (por defecto) o `'compact'` — ajusta el tamaño de la miniatura y el
   * padding vertical de cada fila. Preferencia puramente visual del
   * usuario, resuelta y persistida por `ProductsPage.tsx`. */
  density?: 'comfortable' | 'compact'
}

/**
 * features/products/components/ProductsTable.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 4: rediseño sobre las capacidades
 * aditivas nuevas de `DataTable.tsx` (`column.headerClassName`,
 * `selectable`/`selectedIds`/`onSelectionChange`) — ninguna otra tabla
 * del proyecto pasa estas props, asi que ninguna cambia (verificado:
 * Categorías/Roles/Proveedores siguen renderizando igual).
 *
 * Cambios respecto a la version anterior a Bloque 4:
 * - "Nombre" + "SKU" se combinan en una sola columna "Producto"
 *   (miniatura + nombre + SKU apilados, via `ProductThumbnail` — ya
 *   existente, usado en catalogo POS/carrito, primer uso en un listado
 *   administrativo) — mejor jerarquia visual, una columna menos.
 * - "Precio de venta" alineado a la derecha (encabezado + celda) con
 *   digitos tabulares, en vez de alineado a la izquierda como texto.
 * - Filas mas compactas (`py-2.5` en vez de `py-4`) para que la tabla
 *   ocupe menos alto por fila y siga siendo el foco principal de la
 *   pantalla en resoluciones de laptop.
 * - Acciones agrupadas en un unico `RowMenu` ("...") en vez de botones-
 *   icono sueltos.
 * - Seleccion de filas opcional: `ProductsPage.tsx` la usa para acotar
 *   la exportacion CSV a lo seleccionado (utilidad real, no decorativa).
 *
 * Bloque 5: click sobre una fila (`onRowClick`, via `DataTable`) abre
 * `ProductDrawer.tsx` — reemplaza el atajo de Bloque 4 "doble click abre
 * Editar" (`onRowDoubleClick` ya no se usa aca), para que la edicion
 * completa quede siempre como una accion EXPLICITA: solo desde el boton
 * "Editar producto" del Drawer o desde "Editar" en el menu "...". La
 * celda de acciones detiene la propagacion del click (`stopPropagation`)
 * para que abrir el menu "..." no dispare tambien `onRowClick`.
 *
 * Bloque Final (auditoria/pulido): columna "Categoría" usa
 * `CategoryBadge.tsx` (color determinístico por `categoryId`, ver
 * `lib/categoryColor.ts`) en vez de texto plano. `RowMenu` gana "Ver
 * detalle" (mismo `onRowClick` que ya abre el Drawer al hacer click en la
 * fila — ahora tambien explicito en el menu) y "Copiar SKU"
 * (`navigator.clipboard`, sin backend, oculto si el producto no tiene
 * SKU). Encabezado de la columna de acciones ahora es "Acciones" con
 * `sr-only` (antes vacio — sin texto accesible para lectores de pantalla).
 *
 * Sin cambios de dominio: misma mutacion de activar/desactivar
 * (`onToggleStatus`, propiedad de `ProductsPage.tsx`) via `ConfirmDialog`
 * (mismo criterio de estado local que ya usan SuppliersTable/
 * CategoriesTable/TaxesTable) — rediseño de workspace (aprobado): el
 * disparador pasa de un item del `RowMenu` a un `Switch` en la columna
 * "Estado" (ver su propio comentario), sin cambiar el flujo de
 * confirmacion.
 *
 * "Eliminar" (bloque de borrado logico, mismo patron ya aprobado en
 * `features/categories/components/CategoriesTable.tsx`): a diferencia de
 * "Activar/Desactivar" (mutacion propiedad de `ProductsPage.tsx`, sin
 * feedback de exito/error), esta tabla llama a `useDeleteProduct()`
 * directamente. El dialogo de confirmacion permanece abierto con
 * `loading` mientras la mutacion esta en curso, se cierra solo al tener
 * exito, y el error (p.ej. "tiene ventas asociadas", 409 del backend) se
 * traduce con `getProductErrorMessage` y se muestra en un `toast.error`
 * sin cerrar el dialogo — el usuario puede reintentar o cancelar. Gated
 * por `<Can permission={PERMISSIONS.PRODUCTS_DELETE}>`: el backend ya
 * rechaza la peticion sin ese permiso (`products.delete` en
 * `authorizePermission`), este `<Can>` solo oculta la opcion en la UI.
 *
 * Estandar de ordenamiento de tablas (ver `ROADMAP.md`): "Producto"/
 * "Precio de venta"/"Estado" declaran `column.sortValue` — el
 * comportamiento visual (▲/▼) y la logica de orden viven enteramente en
 * `DataTable.tsx`, sin duplicarse aca. Orden inicial: Producto A→Z.
 */
export function ProductsTable({
  products,
  emptyMessage = 'No hay productos para mostrar.',
  onRowClick,
  onEdit,
  onToggleStatus,
  selectedIds,
  onSelectionChange,
  density = 'comfortable',
}: ProductsTableProps) {
  const isCompact = density === 'compact'
  const [pendingToggle, setPendingToggle] = useState<Product | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)
  const { mutate: deleteProduct, isPending: isDeleting } = useDeleteProduct()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission(PERMISSIONS.PRODUCTS_UPDATE)

  const handleToggleStatusClick = (product: Product) => {
    setPendingToggle(product)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const handleDeleteClick = (product: Product) => {
    setPendingDelete(product)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deleteProduct(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Producto "${pendingDelete.name}" eliminado correctamente.`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getProductErrorMessage(error))
      },
    })
  }

  // Bloque Final: utilidad de portapapeles — sin backend, sin endpoint
  // nuevo, solo el SKU que ya esta en pantalla. Util para personal que
  // pega el SKU en un lector de codigo de barras/otro sistema.
  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku)
    toast.success('SKU copiado al portapapeles.')
  }

  // Rediseño de Workspace de Productos (aprobado): margen bruto
  // (`(salePrice - cost) / salePrice`), calculado en el cliente con dos
  // campos que YA vienen en cada fila del listado (`Product.salePrice`/
  // `Product.cost`) — sin request adicional. `null` si `salePrice` es 0
  // (division invalida) o si `cost` no esta definido; la celda omite la
  // segunda linea en ese caso en vez de mostrar `NaN`/`Infinity`.
  const getMarginPercent = (product: Product): number | null => {
    if (!product.salePrice || product.cost === undefined || product.cost === null) {
      return null
    }
    return Math.round(((product.salePrice - product.cost) / product.salePrice) * 100)
  }

  const columns: DataTableColumn<Product>[] = [
    {
      // Identidad propia del catalogo (aprobado): franja de color por
      // categoria al borde izquierdo de cada fila — mismo color
      // deterministico que ya usa `CategoryBadge` (`lib/categoryColor.ts`,
      // sin logica nueva), permite escanear categorias por color sin leer
      // cada badge en catalogos largos.
      header: '',
      headerClassName: 'sr-only',
      render: (product) => (
        <span
          className="block h-8 w-1.5 rounded-full"
          style={resolveCategoryColor({ id: product.categoryId, color: product.category.color }).dot}
          aria-hidden="true"
        />
      ),
      className: 'w-2 p-0 pl-3',
    },
    {
      // Ajuste final (aprobado, "composicion visual, no solo anchos"): la
      // columna "Categoría" independiente se retira — un badge angosto
      // solo en una columna ancha era exactamente el patron que dejaba
      // "espacio vacio en el medio" (el ancho liberado por otras columnas
      // terminaba como aire alrededor de un contenido chico, no como
      // contenido real). La categoria se pliega aca como segunda linea
      // (punto de color + nombre, mismo color deterministico que ya
      // pintaba el badge retirado y la franja lateral) junto al SKU — el
      // "Producto" pasa de 2 a 3 datos reales por fila (nombre+unidad,
      // SKU, categoria), con mas peso visual genuino en vez de necesitar
      // una columna aparte para un dato chico.
      header: 'Producto',
      sortValue: (product) => product.name,
      headerClassName: 'max-w-[320px]',
      className: 'max-w-[320px]',
      render: (product) => (
        <div className="flex items-center gap-3.5">
          <ProductThumbnail
            imageUrl={product.imageUrl}
            title={product.name}
            containerClassName={cn(
              'shrink-0 rounded-lg transition-all duration-200',
              isCompact ? 'size-9' : 'size-12',
            )}
            textClassName={cn('text-brand/50', isCompact ? 'text-sm' : 'text-base')}
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[0.9375rem] font-semibold text-foreground">
              <span className="truncate">{product.name}</span>
              <span className="shrink-0 rounded-md bg-accent-teal/10 px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide text-accent-teal">
                {product.unitOfMeasure === 'KILOGRAM' ? 'KG' : 'UN'}
              </span>
            </p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-mono">{product.sku ?? 'Sin SKU'}</span>
              <span className="shrink-0 text-border">·</span>
              <span className="flex min-w-0 items-center gap-1 truncate">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={resolveCategoryColor({ id: product.categoryId, color: product.category.color }).dot}
                  aria-hidden="true"
                />
                <span className="truncate">{product.category.name}</span>
              </span>
            </p>
          </div>
        </div>
      ),
    },
    {
      // Pulido visual (aprobado): se retira el fondo tipo "chip" — el
      // precio vuelve a ser texto simple (color de marca, misma
      // jerarquia que antes), centrado en su columna sin envoltorio
      // propio, mas liviano y consistente con el resto de la tabla (que
      // ya no tiene ninguna otra celda con fondo). El margen se mantiene
      // como segunda linea, mas chica y en `text-muted-foreground`, con
      // menor protagonismo que el precio. Sin `max-w-*`: es la columna
      // con mas jerarquia comercial de la tabla, recibe el ancho que
      // "Producto"/"Estado" no necesitan.
      header: 'Precio de venta',
      sortValue: (product) => product.salePrice,
      headerClassName: 'text-center',
      render: (product) => {
        const margin = getMarginPercent(product)

        return (
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-brand">
              {formatCurrency(product.salePrice)}
            </p>
            {margin !== null && (
              <p className="text-xs tabular-nums text-muted-foreground">{margin}% margen</p>
            )}
          </div>
        )
      },
      className: 'align-middle',
    },
    {
      // Rediseño de workspace (aprobado): switch en vez de badge de solo
      // lectura + accion en el menu "..." — activar/desactivar pasa de 2
      // clicks (abrir "...", elegir la opcion) a 1. Reutiliza EXACTAMENTE
      // el mismo flujo de confirmacion ya existente (`pendingToggle` +
      // `ConfirmDialog` mas abajo, misma mutacion `onToggleStatus` de
      // `ProductsPage.tsx`) — el switch solo abre el dialogo, nunca
      // aplica el cambio directamente. `stopPropagation` evita que
      // tocar el switch tambien abra el Drawer (mismo criterio que la
      // columna de Acciones).
      //
      // Ajuste final (aprobado): verde para Activo / rojo para Inactivo,
      // en un chip con fondo tenue en vez de flotar solo en la celda,
      // centrado en su columna. Pulido visual: la columna gana un ancho
      // minimo (`min-w-[9.5rem]`) y el chip un poco mas de padding —
      // antes el switch+texto quedaban justos contra el borde del chip.
      header: 'Estado',
      sortValue: (product) => (product.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (product) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              product.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={product.active}
              disabled={!canUpdate}
              title={!canUpdate ? 'No tenés permiso para cambiar el estado de un producto.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(product)}
              aria-label={product.active ? `Desactivar ${product.name}` : `Activar ${product.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn(
                'text-sm font-medium',
                product.active ? 'text-success' : 'text-destructive',
              )}
            >
              {product.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      // Bloque Final: encabezado accesible (`sr-only`) — el "..." de cada
      // fila ya se explica por si mismo visualmente, pero un lector de
      // pantalla anunciaba esta columna sin ningun texto.
      //
      // Ajuste final (aprobado): "Ver detalle"/"Editar" (las dos acciones
      // mas frecuentes) se agregan tambien como iconos que aparecen al
      // pasar el cursor sobre la fila (`group-hover`, requiere que
      // `ProductsTable` agregue `group` a `rowClassName` de `DataTable`,
      // ver mas abajo) — mismos handlers que ya usaba el `RowMenu`
      // (`onRowClick`/`onEdit`), sin logica nueva, solo un segundo punto
      // de entrada visual. "Copiar SKU"/"Eliminar" (menos frecuentes, una
      // destructiva) se quedan exclusivamente en el menu "...".
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (product) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(product)}
              aria-label={`Ver detalle de ${product.name}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <Can permission={PERMISSIONS.PRODUCTS_UPDATE}>
              <button
                type="button"
                onClick={() => onEdit?.(product)}
                aria-label={`Editar ${product.name}`}
                title="Editar"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </Can>
          </div>
          <RowMenu label={`Acciones para ${product.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(product)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.PRODUCTS_UPDATE}>
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(product)}>
                Editar
              </RowMenuItem>
            </Can>
            {product.sku && (
              <RowMenuItem icon={Copy} onClick={() => handleCopySku(product.sku as string)}>
                Copiar SKU
              </RowMenuItem>
            )}
            <Can permission={PERMISSIONS.PRODUCTS_DELETE}>
              <RowMenuItem
                icon={Trash2}
                destructive
                onClick={() => handleDeleteClick(product)}
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
        data={products}
        getRowKey={(product) => product.id}
        emptyMessage={emptyMessage}
        tableClassName="rounded-none border-0 shadow-none overflow-visible"
        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/90 uppercase"
        rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
        cellClassName={isCompact ? 'px-4 py-1.5' : 'px-4 py-2.5'}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        stickyHeader
        initialSort={{ header: 'Producto', direction: 'asc' }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar producto' : 'Activar producto'}
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
        title="Eliminar producto"
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
