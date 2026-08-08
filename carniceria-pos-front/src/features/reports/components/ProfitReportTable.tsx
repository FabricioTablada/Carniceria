import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import type { ProfitReportItem } from '../types/report.types'

interface ProfitReportTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: ProfitReportItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-02, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual") — se dispara al
   * hacer clic sobre una fila, para abrir la venta de esa línea (mismo
   * `SaleDetailDialog` que `SalesReportTable.tsx`). Opcional. */
  onRowClick?: (item: ProfitReportItem) => void
}

export function ProfitReportTable({
  items,
  emptyMessage = 'No hay detalle de utilidad para mostrar.',
  onRowClick,
}: ProfitReportTableProps) {
  // Bloque C (Reporte de Utilidad, auditoria/analisis financiero): mismo
  // orden y mismo criterio ya aprobados en `SaleDetailContent.tsx`
  // (Bloque A) y `SalesReportTable.tsx` (Bloque B) — las columnas de
  // dinero siguen el recorrido real del calculo (`sales/service.ts`,
  // `computeItems`): Precio unitario -> Descuento -> Subtotal
  // (`lineSubtotal`, ya con el descuento restado) -> Impuesto (`lineTax`,
  // calculado SOBRE ese subtotal) -> Total (`lineTotal`). Los datos ya
  // existian en `ProfitReportItem` (`taxRate`, `discount`, `lineSubtotal`,
  // `lineTax`) desde siempre — solo faltaba pedirselos. `tax` (nombre) es
  // lo unico nuevo: requirio agregar el join en `profitReportInclude`
  // (backend, `reports.repository.ts`), replicando exactamente lo que
  // `sales/service.ts` ya hace para el Detalle de Venta.
  //
  // Pulido de distribución (aprobado): 14 columnas es la tabla más densa
  // del módulo — `whitespace-nowrap` en TODAS las numéricas (nunca se
  // parten en 2 líneas) y `truncate max-w-*` en Producto/SKU acotan lo
  // que se puede acotar, pero con esta cantidad de columnas de dinero
  // reales (ninguna se elimina/oculta, pedido explícito) `scrollX` sigue
  // siendo necesario como respaldo — "siempre que sea posible" no aplica
  // a esta tabla en particular en una pantalla Full HD.
  //
  // Bloque 7.30 (reducción de scroll horizontal, aprobado): el padding
  // general pasa de `px-4 py-4` (heredado de `DataTable` + el
  // `cellClassName`/`headerClassName` propios de esta tabla) a
  // `px-2.5 py-2.5` — único cambio que afecta a las 14 columnas por
  // igual, sin tocar `DataTable.tsx` (override por instancia, mismo
  // mecanismo ya usado en el resto del proyecto). Los 4 encabezados de
  // dos palabras cuyo título es más ancho que el monto que encabezan
  // ("Costo unitario"/"Costo efectivo"/"Precio unitario"/"Costo total")
  // ganan `whitespace-normal max-w-[4.5rem] leading-tight` — el título se
  // acomoda en 2 líneas en vez de forzar la columna a ensancharse solo
  // para que entre en una sola línea; el monto de la celda sigue en una
  // sola línea (`whitespace-nowrap`, sin cambios). El resto de los
  // encabezados ya son más cortos que su propio contenido numérico —
  // forzarlos a 2 líneas no reduciría nada, se dejan en una sola línea.
  const TWO_LINE_HEADER = 'text-right whitespace-normal max-w-[4.5rem] leading-tight'

  const columns: DataTableColumn<ProfitReportItem>[] = [
    {
      header: 'Documento',
      sortValue: (item) => item.sale.documentNumber ?? '',
      render: (item) => item.sale.documentNumber ?? '—',
      className: 'whitespace-nowrap text-[0.9375rem] font-semibold',
    },
    {
      header: 'Fecha',
      sortValue: (item) => item.sale.saleDate,
      render: (item) => {
        // Bloque 7.35: `item.sale.saleDate` es un instante UTC real (no un
        // calendario puro) — `slice(0, 10)` asumía que ya representaba el
        // día de Costa Rica, mostrando un día adelantado para ventas entre
        // 18:00 y 23:59 hora de Costa Rica. Mismo fix ya aplicado y
        // validado en `SalesReportTable.tsx` (05/08/2026): reutiliza
        // `formatDateTime` (única fuente de verdad, zona horaria de Costa
        // Rica) y descarta la hora para no cambiar el formato visual.
        return formatDateTime(item.sale.saleDate).split(' ')[0]
      },
      className: 'whitespace-nowrap text-muted-foreground',
    },
    {
      header: 'Producto',
      sortValue: (item) => item.product.name,
      // Incidencia 1 (06/08/2026): indicación pequeña de descuento por
      // promoción automática debajo del nombre — mismo dato que ya se ve
      // en el Detalle de Venta, solo visible cuando `discountPercent`
      // viene no-nulo (ver `ProfitReportItem.discountPercent`). No agrega
      // columnas ni cambia el ancho de la celda existente.
      render: (item) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{item.product.name}</span>
          {item.discountPercent !== null && (
            <span className="truncate text-[0.6875rem] font-normal text-muted-foreground">
              -{item.discountPercent}% descuento
            </span>
          )}
        </div>
      ),
      className: 'max-w-[12rem] font-semibold',
    },
    {
      header: 'SKU',
      render: (item) => item.product.sku ?? '—',
      className: 'max-w-[6rem] truncate whitespace-nowrap text-muted-foreground',
    },
    {
      header: 'Cantidad',
      headerClassName: 'text-right',
      render: (item) => item.quantity,
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      // Bloque 14.2 (Costos Base): ahora usa el snapshot inmutable
      // `SaleItem.unitCost`, NUNCA `product.cost` (costo vigente, que
      // pudo cambiar desde la venta y falsearia el costo historico).
      // Ventas anteriores a este bloque no tienen snapshot ("—").
      header: 'Costo unitario',
      headerClassName: TWO_LINE_HEADER,
      render: (item) => (item.unitCost !== null ? formatCurrency(item.unitCost) : '—'),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      // Bloque COST-03 (integracion con el CostEngine): costo REALMENTE
      // usado para calcular costo total/utilidad/margen. Identico al
      // "Costo unitario" cuando el producto no tiene activada la regla de
      // merma esperada — solo difiere cuando si la tiene activada.
      header: 'Costo efectivo',
      headerClassName: TWO_LINE_HEADER,
      render: (item) => (item.effectiveCost !== null ? formatCurrency(item.effectiveCost) : '—'),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Precio unitario',
      headerClassName: TWO_LINE_HEADER,
      render: (item) => formatCurrency(item.unitPrice),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Descuento',
      headerClassName: 'text-right',
      render: (item) => (item.discount > 0 ? formatCurrency(item.discount) : '—'),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Subtotal',
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.lineSubtotal),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Impuesto',
      headerClassName: 'text-right',
      render: (item) =>
        item.tax ? (
          <div className="flex flex-col items-end">
            <span className="whitespace-nowrap">
              {item.tax.name} ({item.taxRate}%)
            </span>
            <span className="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {formatCurrency(item.lineTax)}
            </span>
          </div>
        ) : (
          'Sin impuesto'
        ),
      className: 'text-right whitespace-nowrap text-muted-foreground',
    },
    {
      header: 'Total',
      sortValue: (item) => item.lineTotal,
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.lineTotal),
      className: 'text-right whitespace-nowrap text-base font-semibold tabular-nums text-brand',
    },
    {
      // Bloque 14.2: costo total de la linea (`unitCost * quantity`),
      // calculado en el backend a partir del snapshot — nunca aqui.
      header: 'Costo total',
      headerClassName: TWO_LINE_HEADER,
      render: (item) => (item.costTotal !== null ? formatCurrency(item.costTotal) : '—'),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Utilidad',
      sortValue: (item) => item.profit ?? -Infinity,
      headerClassName: 'text-right',
      render: (item) =>
        item.profit !== null ? (
          <span className={item.profit < 0 ? 'text-destructive' : 'text-success'}>
            {formatCurrency(item.profit)}
          </span>
        ) : (
          '—'
        ),
      className: 'text-right whitespace-nowrap font-semibold tabular-nums',
    },
    {
      header: 'Margen',
      sortValue: (item) => item.marginPercent ?? -Infinity,
      headerClassName: 'text-right',
      render: (item) => (item.marginPercent !== null ? `${item.marginPercent.toFixed(1)}%` : '—'),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowKey={(item) => item.id}
      emptyMessage={emptyMessage}
      initialSort={{ header: 'Fecha', direction: 'desc' }}
      onRowClick={onRowClick}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="px-2.5 py-2.5 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="px-2.5 py-2.5"
      scrollX
    />
  )
}
