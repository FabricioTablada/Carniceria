import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * components/ui/DataTable.tsx
 * -----------------------------------------------------------------------------
 * Componente base para las tablas de listado del proyecto. Replica
 * exactamente el markup y las clases que hoy estan duplicadas a mano en las
 * 20 tablas de `features/*` (ProductsTable, UsersTable, CashReportTable,
 * ConfigurationsTable, etc.): wrapper con borde redondeado, encabezado sobre
 * `bg-muted/50`, fila vacia centrada con `colSpan` automatico, y filas con
 * `hover:bg-muted/30`.
 *
 * `columns` unifica encabezado y celda en una sola definicion (`header` +
 * `render(row)`), en vez de mantener el arreglo de encabezados y las celdas
 * del `<tbody>` como dos listas separadas, que es como estan hoy la mayoria
 * de las tablas existentes. `className` es opcional y solo existe para
 * preservar clases que ya tenian algunas celdas en el `<td>` original (por
 * ejemplo `text-muted-foreground` en columnas secundarias), sin agregar
 * nuevas capacidades al componente.
 *
 * Sin logica de dominio, sin ordenamiento, sin paginacion, sin filtros, sin
 * seleccion: solo presenta `data` tal como llega por props, igual que las
 * tablas actuales.
 *
 * `headerClassName`/`rowClassName`/`cellClassName`/`tableClassName` son
 * opcionales y por defecto `undefined` — sin ellas, el markup y las clases
 * son exactamente las mismas que antes de agregarlas, asi que ninguna de
 * las 20 tablas existentes cambia visualmente. Se agregaron unicamente
 * para que `ProductsTable.tsx` pueda aplicar un lenguaje visual mas
 * moderno (mismo del POS/Dashboard) sin duplicar el markup de `DataTable`
 * ni tocar ninguna otra tabla del proyecto.
 *
 * Sprint UX/UI PIPASA V1, Bloque 4: dos capacidades nuevas, ambas
 * opcionales y con el mismo criterio aditivo de arriba —
 * `column.headerClassName` (alineacion por columna, ej. encabezados
 * numericos alineados a la derecha) y `selectable`/`selectedIds`/
 * `onSelectionChange` (checkbox por fila + "seleccionar todo"). Ninguna
 * tabla existente pasa estas props hoy, asi que ninguna cambia: la
 * columna de seleccion solo se renderiza cuando `selectable` es `true` Y
 * se recibe `onSelectionChange`. Verificado sin regresion en
 * CategoriesTable/RolesTable/SuppliersTable (no usan las props nuevas).
 *
 * Bloque 5: `onRowClick`, mismo criterio aditivo — la fila de checkbox
 * detiene la propagacion del click (`stopPropagation`) para que marcar
 * una fila nunca dispare tambien `onRowClick`; el resto de columnas
 * (incluida cualquier celda con sus propios botones/menus, ej. la
 * columna de acciones) es responsabilidad de quien define esa columna
 * si necesita evitar el mismo solapamiento.
 *
 * Bloque 7 (pulido final): `emptyMessage` ensanchado de `string` a
 * `ReactNode` — cambio compatible (un `string` sigue siendo un
 * `ReactNode` valido), permite que `ProductsTable.tsx` pase un estado
 * vacio con icono/accion (`ProductsEmptyState.tsx`) sin que las otras
 * ~20 tablas, que siguen pasando texto plano, cambien. Los checkboxes de
 * seleccion (fila y "seleccionar todo") ahora tienen anillo de foco
 * visible (`focus-visible:ring-*`, mismo criterio ya usado en
 * `RolePermissionSelector.tsx`) — antes no tenian ninguno.
 *
 * Bloque Final (auditoria/pulido): cuando se recibe `onRowClick`, la fila
 * ahora tambien es alcanzable por teclado — `tabIndex={0}` + `Enter`/
 * `Espacio` disparan la misma accion que el click, con anillo de foco
 * visible (`focus-visible:ring-*`, mismo tono que el resto del modulo).
 * Sin `onRowClick` (las ~20 tablas restantes) la fila sigue sin
 * `tabIndex` ni manejador de teclado — cero cambio de comportamiento.
 *
 * Sprint UX/UI PIPASA V1 — Inventario: `scrollX` (opcional, `false` por
 * defecto). Corrige el desbordamiento horizontal detectado en
 * `InventoryWasteTable.tsx` (8 columnas angostadas hasta cortar la
 * columna "Usuario") sin tocar ninguna de las otras ~20 tablas: el
 * wrapper pasa de `overflow-hidden` a `overflow-x-auto` y la `<table>`
 * gana `min-w-max` (se dimensiona segun su contenido real en vez de
 * angostarse para caber a la fuerza), habilitando scroll horizontal
 * genuino en vez de recortar contenido. Con `scrollX` ausente/`false`,
 * el markup y las clases son exactamente las mismas que antes.
 *
 * Bloque 11.1 (refinamiento de Ventas): `stickyHeader` (opcional, `false`
 * por defecto). Pensado para cuando esta tabla vive dentro de un
 * contenedor angosto con SU PROPIO `overflow-y-auto` (ej. la lista de
 * productos de `SaleDetailContent.tsx`, acotada a ~5-6 filas) — sin esto,
 * el encabezado se desplaza junto con las filas y se pierde de vista al
 * scrollear. `sticky top-0` se aplica a cada `<th>` (no al `<thead>`: mas
 * consistente entre navegadores) con su propio fondo solido para que las
 * filas que pasan por debajo no se transparenten. Aditivo: sin
 * `stickyHeader`, el markup es identico al de siempre — ninguna de las
 * demas tablas cambia.
 *
 * Workspace Promociones (aprobado, "nuevo estandar de ordenamiento para
 * todo el ERP"): `column.sortValue` (opcional) habilita el ordenamiento
 * por esa columna — funcion que extrae el valor comparable (`string` o
 * `number`) de cada fila. Columnas sin `sortValue` no son ordenables
 * (mismo criterio aditivo de siempre: `PromotionsTable.tsx` es el primer
 * consumidor real, ninguna de las ~20 tablas restantes declara esta prop,
 * asi que ninguna cambia). El estado de orden (columna + direccion) vive
 * DENTRO de `DataTable` (no se levanta al padre): es ordenamiento sobre
 * los datos YA CARGADOS de la pagina actual, sin ida y vuelta al backend
 * — no hay nada que un componente externo necesite coordinar. `initialSort`
 * fija el orden inicial (ej. "Promoción" ascendente); sin el, los datos
 * se muestran en el orden en que llegan por `data`, igual que siempre.
 * Clickear un encabezado ordenable alterna asc/desc; clickear uno
 * distinto empieza en ascendente. Cada `<th>` ordenable muestra un icono
 * ▲/▼ (`ChevronUp`/`ChevronDown` de lucide, mismo lenguaje de iconos que
 * el resto del Design System en vez de caracteres Unicode sueltos) — el
 * sentido activo resaltado (`text-foreground`), el inactivo atenuado
 * (`text-muted-foreground/40`).
 */
export interface DataTableColumn<T> {
  /** Texto del encabezado de la columna. */
  header: string
  /** Contenido de la celda para una fila dada. */
  render: (row: T) => ReactNode
  /** Clase opcional aplicada al <td> de la columna. */
  className?: string
  /** Clase opcional aplicada al <th> de esta columna especifica, ademas
   * de `headerClassName` (prop general) — util para alinear a la derecha
   * el encabezado de una columna numerica sin afectar las demas. */
  headerClassName?: string
  /** Habilita el ordenamiento por esta columna — extrae el valor
   * comparable de cada fila. Opcional: sin esta prop, la columna no es
   * ordenable (mismo criterio aditivo del resto de `DataTable`). Ver
   * comentario de archivo, "Workspace Promociones". */
  sortValue?: (row: T) => string | number
}

interface DataTableSort {
  /** `column.header` de la columna activa — mismo identificador que ya
   * usa `DataTable` como `key` de cada columna, sin inventar un `id`
   * paralelo. */
  header: string
  direction: 'asc' | 'desc'
}

interface DataTableProps<T> {
  /** Definicion de columnas: encabezado + celda, en un unico lugar. */
  columns: DataTableColumn<T>[]
  /** Filas a mostrar. El componente no obtiene datos por si mismo. */
  data: T[]
  /** Genera la `key` de React para cada fila. */
  getRowKey: (row: T) => string
  /** Contenido mostrado cuando `data` esta vacio. */
  emptyMessage?: ReactNode
  /** Clase opcional agregada al `<th>` de cada columna, ademas de la base. */
  headerClassName?: string
  /** Clase opcional agregada a cada `<tr>` de datos, ademas de la base.
   * Rediseño de Impuestos (aprobado): tambien acepta una funcion `(row) =>
   * string` para resaltar una fila puntual segun su propio dato (ej. el
   * impuesto marcado como predeterminado en `TaxesTable.tsx`) — aditivo,
   * las ~20 tablas que hoy pasan un `string` fijo no cambian. */
  rowClassName?: string | ((row: T) => string)
  /** Clase opcional agregada a cada `<td>`, ademas de la base — se aplica
   * antes de `column.className`, que sigue pudiendo sobreescribirla por
   * columna igual que hoy. */
  cellClassName?: string
  /** Clase opcional agregada al `<div>` contenedor, ademas de la base. */
  tableClassName?: string
  /** Si es `true` (y se recibe `onSelectionChange`), agrega una columna
   * de checkboxes (fila + "seleccionar todo"). Por defecto `false`. */
  selectable?: boolean
  /** IDs seleccionados actualmente (via `getRowKey`). El componente no
   * mantiene estado propio de seleccion. */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. Requerido junto a
   * `selectable` para que se renderice la columna de checkboxes. */
  onSelectionChange?: (ids: string[]) => void
  /** Se dispara al hacer doble click sobre una fila (fuera de la columna
   * de seleccion). Atajo de productividad opcional — patron comun en ERPs
   * modernos (Notion/Linear/Airtable): doble click abre/edita la fila sin
   * tener que apuntar al menu de acciones. */
  onRowDoubleClick?: (row: T) => void
  /** Se dispara al hacer click sobre una fila (fuera de la columna de
   * seleccion). Cuando se recibe, la fila muestra `cursor-pointer`. */
  onRowClick?: (row: T) => void
  /** Habilita scroll horizontal genuino en vez de angostar las columnas
   * hasta cortar contenido — util para tablas con muchas columnas (ver
   * `InventoryWasteTable.tsx`). Por defecto `false`: el wrapper sigue
   * usando `overflow-hidden` exactamente como antes. */
  scrollX?: boolean
  /** Ancla el encabezado (`sticky top-0`) para tablas dentro de un
   * contenedor con su propio scroll vertical — ver comentario de archivo.
   * Por defecto `false`: sin cambios para las demas tablas. */
  stickyHeader?: boolean
  /** Orden inicial — solo tiene efecto si la columna referenciada
   * (`header`) declara `sortValue`. Por defecto sin orden: `data` se
   * muestra en el orden en que llega. */
  initialSort?: DataTableSort
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = 'No hay datos para mostrar.',
  headerClassName,
  rowClassName,
  cellClassName,
  tableClassName,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onRowDoubleClick,
  onRowClick,
  scrollX = false,
  stickyHeader = false,
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<DataTableSort | null>(initialSort ?? null)

  const showSelection = selectable && onSelectionChange !== undefined
  const selectedSet = new Set(selectedIds ?? [])
  const rowKeys = data.map(getRowKey)
  const allSelected = showSelection && rowKeys.length > 0 && rowKeys.every((key) => selectedSet.has(key))
  const someSelected = showSelection && !allSelected && rowKeys.some((key) => selectedSet.has(key))
  const columnCount = columns.length + (showSelection ? 1 : 0)

  const sortColumn = sort ? columns.find((column) => column.header === sort.header) : undefined
  const sortedData =
    sort && sortColumn?.sortValue
      ? [...data].sort((a, b) => {
          const left = sortColumn.sortValue!(a)
          const right = sortColumn.sortValue!(b)
          const comparison =
            typeof left === 'number' && typeof right === 'number'
              ? left - right
              : String(left).localeCompare(String(right), 'es')
          return sort.direction === 'asc' ? comparison : -comparison
        })
      : data

  const handleSortClick = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return

    setSort((current) => {
      if (current?.header === column.header) {
        return { header: column.header, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { header: column.header, direction: 'asc' }
    })
  }

  const toggleAll = () => {
    onSelectionChange?.(allSelected ? [] : rowKeys)
  }

  const toggleRow = (key: string) => {
    if (!onSelectionChange) return
    const next = new Set(selectedSet)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onSelectionChange(Array.from(next))
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-sm',
        scrollX ? 'overflow-x-auto' : 'overflow-hidden',
        tableClassName,
      )}
    >
      <table className={cn('w-full text-sm', scrollX && 'min-w-max')}>
        <thead>
          <tr className="border-b bg-muted/50">
            {showSelection && (
              <th
                scope="col"
                className={cn('w-10 px-4 py-3', stickyHeader && 'sticky top-0 z-10 bg-muted/50')}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  aria-label="Seleccionar todas las filas"
                  className="size-4 rounded border-input accent-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                />
              </th>
            )}
            {columns.map((column) => {
              const isSortable = Boolean(column.sortValue)
              const isActiveSort = sort?.header === column.header

              return (
                <th
                  key={column.header}
                  scope="col"
                  aria-sort={
                    isActiveSort ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase',
                    stickyHeader && 'sticky top-0 z-10 bg-muted/50',
                    headerClassName,
                    column.headerClassName,
                  )}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortClick(column)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {column.header}
                      <span className="inline-flex flex-col -space-y-1">
                        <ChevronUp
                          className={cn(
                            'size-3',
                            isActiveSort && sort?.direction === 'asc'
                              ? 'text-foreground'
                              : 'text-muted-foreground/40',
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            'size-3',
                            isActiveSort && sort?.direction === 'desc'
                              ? 'text-foreground'
                              : 'text-muted-foreground/40',
                          )}
                        />
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row) => {
              const key = getRowKey(row)

              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
                  className={cn(
                    'border-b transition-colors duration-200 last:border-b-0 hover:bg-card-hover',
                    onRowClick &&
                      'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50',
                    typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
                  )}
                >
                  {showSelection && (
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(key)}
                        onChange={() => toggleRow(key)}
                        aria-label="Seleccionar fila"
                        className="size-4 rounded border-input accent-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={cn('px-4 py-3', cellClassName, column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
