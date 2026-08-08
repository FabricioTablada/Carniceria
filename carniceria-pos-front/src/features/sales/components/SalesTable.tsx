import type { ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatDiscountCell, getSaleTotalDiscount } from '../utils/saleDiscount'
import type { Sale } from '../types/sale.types'

interface SalesTableProps {
  /** Ventas a mostrar. La tabla no obtiene datos por si misma. */
  sales: Sale[]
  /** Contenido mostrado cuando `sales` esta vacio — texto simple o
   * `SalesEmptyState.tsx` (Bloque 11, mismo criterio que
   * `ProductsTable.tsx`/`ProductsEmptyState.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque 3 ("Detalle de Venta"): cuando se pasa, agrega una columna de
   * accion "Ver detalle" que dispara este callback con el id de la venta —
   * quien la use decide que hacer (abrir `SaleDetailDialog.tsx`). Opcional
   * y por defecto ausente: `SalesPage.tsx` (Bloque 1) no la pasa, sin
   * ningun cambio visual para ese consumidor. */
  onSelectSale?: (saleId: string) => void
  /** Bloque POS-06: cuando se pasa, agrega un segundo boton (solo icono)
   * de "Vista rapida" junto a "Ver" — dispara este callback con el id de
   * la venta, sin decidir aca que hace con el (mismo criterio agnostico
   * que `onSelectSale`). Opcional y por defecto ausente: `SalesPage.tsx`
   * no lo pasa, sin ningun cambio visual para ese consumidor. Quien lo
   * use (`SessionSalesDialog.tsx`) es responsable de toda la logica del
   * POS (resolver la venta ya cargada, abrir el panel, etc.) — este
   * archivo no sabe ni le importa que hay del otro lado. */
  onQuickView?: (saleId: string) => void
  /** QA (UX, "Ventas de la sesión"): densidad reducida — filas mas bajas,
   * texto mas chico, para que las 10 ventas mas recientes quepan con
   * menos scroll dentro del panel. Opcional y por defecto `false`: sin
   * pasarla, esta tabla se ve identica a como se veia antes (mismo
   * consumidor que `SalesPage.tsx`, que no la pasa). */
  compact?: boolean
  /** Centro de Operaciones (aprobado, "fila completa clicable"): se
   * dispara al hacer clic sobre la fila (fuera de la columna de
   * acciones) — `SalesPage.tsx` lo pasa (mismo destino que "Ver"),
   * `SessionSalesDialog.tsx` (POS) NO lo pasa, sin ningún cambio de
   * comportamiento para ese consumidor. */
  onRowClick?: (sale: Sale) => void
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completada',
  CANCELLED: 'Anulada',
  REFUNDED: 'Reembolsada',
}

// Mismo patron ya usado por el resto de "status badges" del proyecto
// (ProductStatusBadge, UserStatusBadge, etc.): la decision de que
// variant corresponde a cada estado vive aca, `Badge` solo presenta.
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  REFUNDED: 'muted',
}

export function SalesTable({
  sales,
  emptyMessage = 'No hay ventas para mostrar.',
  onSelectSale,
  onQuickView,
  compact = false,
  onRowClick,
}: SalesTableProps) {
  // Centro de Operaciones (aprobado): mismo estándar de Reportes —
  // `sortValue` en las columnas donde tiene sentido, `whitespace-nowrap`
  // en columnas cortas/numéricas y `truncate max-w-*` en texto libre
  // (Sucursal/Cajero). Sin cambios para `compact` (POS): sus anchos ya
  // acotados (`truncate max-w-[Nrem]`) se mantienen tal cual.
  const columns: DataTableColumn<Sale>[] = [
    {
      header: 'Documento',
      sortValue: (sale) => sale.documentNumber ?? '',
      // QA (ajuste de presentacion): `text-sm` solo (intento previo) no
      // alcanzo — el codigo seguia partiendose en dos lineas segun
      // captura real. Se reduce un paso mas (`text-xs`, el mismo tamano
      // que ya usa el encabezado de esta misma tabla) y se agrega
      // `whitespace-nowrap` UNICAMENTE a esta celda para garantizar una
      // sola linea sin importar el ancho resultante de la columna — el
      // encabezado ("Documento") sigue usando el tamano de encabezado
      // compartido de `DataTable` (`headerClassName`, sin cambios), y
      // `font-semibold` se mantiene.
      render: (sale) => sale.documentNumber ?? '—',
      className: 'text-xs font-semibold whitespace-nowrap',
    },
    // Pulido visual final del POS (aprobado, "dar prioridad visual a
    // Estado/Total/Fecha/Acciones — el botón Ver debe verse completo"):
    // "Sucursal" se omite por completo en `compact` — dentro de "Ventas
    // de la sesión" TODAS las filas son de la MISMA sucursal (la de la
    // sesión de caja activa, ya visible en `PosHeader.tsx`), repetirla en
    // cada fila no aporta nada y le resta ancho real a las columnas que sí
    // importan acá. La tabla administrativa (`compact: false`) no cambia:
    // ahí sí conviven ventas de distintas sucursales.
    ...(compact
      ? []
      : [
          {
            header: 'Sucursal',
            sortValue: (sale: Sale) => sale.sucursal.name,
            render: (sale: Sale) => sale.sucursal.name,
            className: 'text-muted-foreground truncate max-w-[10rem]',
          } satisfies DataTableColumn<Sale>,
        ]),
    {
      header: 'Cajero',
      sortValue: (sale) => sale.user.fullName,
      render: (sale) => sale.user.fullName,
      // `compact`: ancho reducido (`10rem` -> `7rem`) — Cajero sigue
      // presente, pero cede espacio a Estado/Total/Fecha/Acciones.
      className: compact
        ? 'text-muted-foreground truncate max-w-[7rem]'
        : 'text-muted-foreground truncate max-w-[10rem]',
    },
    // Bloque 8.3: mismo criterio que "Sucursal" arriba — se omite en
    // `compact` (POS, "Ventas de la sesión") para no quitarle ancho a las
    // columnas que sí importan ahí; la tabla administrativa lo muestra
    // siempre.
    ...(compact
      ? []
      : [
          {
            header: 'Cliente',
            sortValue: (sale: Sale) => sale.customer?.name ?? 'Público General',
            render: (sale: Sale) => sale.customer?.name ?? 'Público General',
            className: 'text-muted-foreground truncate max-w-[10rem]',
          } satisfies DataTableColumn<Sale>,
        ]),
    {
      header: 'Estado',
      sortValue: (sale) => STATUS_LABELS[sale.status] ?? sale.status,
      render: (sale) => (
        // `min-w` fijo + `justify-center`: las 3 etiquetas ("Completada",
        // "Cancelada", "Reembolsada") tienen largos distintos — sin un
        // ancho comun la columna se ve dentada. Mismo ancho para las 3,
        // texto centrado, columna perfectamente alineada de punta a punta.
        // Punto de color (`bg-current`) + texto en vez de pastilla solida:
        // se lee mas rapido y se siente mas fino, mismo `Badge` compartido
        // del Design System, solo cambia el contenido que se le pasa.
        <Badge
          variant={STATUS_VARIANTS[sale.status] ?? 'muted'}
          className={
            compact
              ? 'w-24 min-w-24 justify-center gap-1 py-0.5 text-[0.6875rem]'
              : 'w-28 min-w-28 justify-center gap-1.5 py-1'
          }
        >
          <span className="size-1.5 shrink-0 rounded-full bg-current" />
          {STATUS_LABELS[sale.status] ?? sale.status}
        </Badge>
      ),
      className: 'align-middle whitespace-nowrap',
    },
    {
      header: 'Descuento',
      headerClassName: 'text-right',
      // Mismo criterio/formato que `SaleDetailContent.tsx` (detalle) y
      // `SalesReportTable.tsx` (Reporte de Ventas) — `getSaleTotalDiscount`
      // (compartida, `utils/saleDiscount.ts`) suma los descuentos manuales
      // de línea + todas las `appliedPromotions` (carrito manual +
      // promociones automáticas), datos que `GET /sales` ya devuelve hoy.
      render: (sale) =>
        formatDiscountCell(getSaleTotalDiscount(sale.items, sale.appliedPromotions)),
      className: compact
        ? 'text-right text-muted-foreground tabular-nums whitespace-nowrap text-xs'
        : 'text-right text-muted-foreground tabular-nums whitespace-nowrap',
    },
    {
      header: 'Total',
      sortValue: (sale) => sale.total,
      headerClassName: 'text-right',
      render: (sale) => formatCurrency(sale.total),
      className: compact
        ? 'text-right text-sm font-bold tabular-nums text-brand whitespace-nowrap'
        : 'text-right text-base font-bold tabular-nums text-brand whitespace-nowrap',
    },
    {
      header: 'Fecha',
      sortValue: (sale) => sale.saleDate,
      render: (sale) => formatDateTime(sale.saleDate),
      className: compact
        ? 'text-muted-foreground tabular-nums whitespace-nowrap text-xs'
        : 'text-muted-foreground tabular-nums whitespace-nowrap',
    },
    // QA (ajuste de presentacion): columna de acciones lo mas angosta
    // posible — "Ver detalle" se acorta a "Ver" (mismo `onSelectSale`,
    // mismo destino, solo cambia la etiqueta) y `whitespace-nowrap` +
    // `w-px` (la columna se encoge al minimo que su contenido permite)
    // evitan que le sobre ancho a esta columna puntual, sin tocar el
    // ancho de ninguna otra.
    //
    // Centro de Operaciones (aprobado, "acciones rápidas al hover"):
    // `opacity-0 group-hover:opacity-100` — mismo patrón ya usado en
    // Compras/Inventario/Usuarios. `stopPropagation` evita que un click
    // en estos botones también dispare `onRowClick` de la fila (mismo
    // criterio ya documentado en `DataTable.tsx`).
    ...(onSelectSale || onQuickView
      ? [
          {
            header: '',
            render: (sale: Sale) => (
              <div
                className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                {onQuickView && (
                  <Button
                    type="button"
                    variant="ghost"
                    size={compact ? 'xs' : 'sm'}
                    aria-label={`Vista rápida de la venta ${sale.documentNumber ?? sale.id}`}
                    onClick={() => onQuickView(sale.id)}
                  >
                    <Eye className="size-3.5" />
                  </Button>
                )}
                {onSelectSale && (
                  <Button
                    type="button"
                    variant="ghost"
                    size={compact ? 'xs' : 'sm'}
                    onClick={() => onSelectSale(sale.id)}
                  >
                    Ver
                  </Button>
                )}
              </div>
            ),
            // Pulido visual final del POS (aprobado, "el botón Ver debe
            // verse completamente"): `w-px` dejaba que la columna se
            // achicara de más en el panel angosto del POS (`compact`),
            // apretando "Ver"/el ícono de vista rápida — ancho mínimo
            // explícito en vez de "lo más chico posible".
            className: compact ? 'w-24 min-w-24 text-right whitespace-nowrap' : 'w-px text-right whitespace-nowrap',
          } satisfies DataTableColumn<Sale>,
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      data={sales}
      getRowKey={(sale) => sale.id}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      initialSort={{ header: 'Fecha', direction: 'desc' }}
      tableClassName="border-border/60 shadow-sm"
      headerClassName={
        compact
          ? 'px-3 py-2 text-[0.6875rem] font-semibold tracking-wider text-foreground/85 uppercase'
          : 'px-5 py-4 text-xs font-semibold tracking-wider text-foreground/85 uppercase'
      }
      rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName={compact ? 'px-3 py-2' : 'px-5 py-4'}
    />
  )
}
