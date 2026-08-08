import type { ReactNode } from 'react'
import { Badge } from '@/components/common/Badge'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { PAYMENT_METHOD_OPTIONS } from '@/features/sales/utils/payment'
import { formatDiscountCell } from '@/features/sales/utils/saleDiscount'
import type { SalesReportItem } from '../types/report.types'

interface SalesReportTableProps {
  /** Filas del reporte a mostrar. La tabla no obtiene datos por si misma. */
  items: SalesReportItem[]
  /** Contenido mostrado cuando `items` esta vacio — texto simple o
   * `EmptyState` (Bloque REPORTES-02, mismo criterio que
   * `ProductsTable.tsx`). */
  emptyMessage?: ReactNode
  /** Bloque Reportes (pulido, "navegación contextual"): se dispara al
   * hacer clic sobre una fila — quien lo use decide qué hacer (abrir el
   * detalle de la venta vía `SaleDetailDialog`, mismo patrón que
   * `CashSessionDetailPage.tsx` ya usa). Opcional: sin esta prop, la fila
   * sigue sin ser clickeable. */
  onRowClick?: (item: SalesReportItem) => void
}

/** Resuelve la etiqueta de un metodo de pago — Bloque REPORTES-02
 * (correccion): unica fuente de verdad para esta etiqueta dentro de
 * Reportes, la misma que ya usan `SalesReportFilters.tsx`/
 * `SalesReportPage.tsx::handleExport` (`PAYMENT_METHOD_OPTIONS`,
 * `@/features/sales/utils/payment`) — antes esta tabla tenia su propio
 * mapeo local (`PAYMENT_METHOD_LABELS`), con el mismo contenido pero una
 * segunda fuente para el mismo dato. */
function getPaymentMethodLabel(item: SalesReportItem): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === item.paymentMethod)?.label ??
    item.paymentMethod
  )
}

export function SalesReportTable({
  items,
  emptyMessage = 'No hay ventas para mostrar.',
  onRowClick,
}: SalesReportTableProps) {
  // Bloque B (Reporte de Ventas, auditoria/conciliacion): orden de las
  // columnas de dinero replica la formula real del backend
  // (`sales/service.ts`, `total = subtotal + taxTotal - discountTotal`) —
  // Subtotal -> Impuesto -> Descuento -> Total, no el orden en que se
  // capturan en el formulario del POS. Mismo criterio ya usado en el
  // desglose por linea de `SaleDetailContent.tsx` (Bloque A): el usuario
  // debe poder leer la fila de izquierda a derecha y llegar al Total sin
  // hacer ninguna cuenta manual. `discountTotal` ya viajaba completo desde
  // `GET /reports/sales` (backend sin cambios); solo faltaba pedirselo.
  //
  // Pulido de distribución (aprobado, "tablas demasiado anchas"): cada
  // columna declara un ancho explícito acorde a su contenido real —
  // `whitespace-nowrap` en columnas cortas/numéricas (nunca se parten en
  // 2 líneas, lo que antes las ensanchaba sin necesidad), `truncate` +
  // `max-w-*` en las de texto libre (Sucursal/Usuario/Referencia, que
  // pueden ser largas) para que no le quiten espacio a las columnas de
  // montos — mismo criterio ya usado en `PurchasesTable.tsx`/
  // `ProductsTable.tsx`. Ningún dato se oculta: todo sigue siendo una
  // columna real, solo con un ancho acotado y truncado visual.
  const columns: DataTableColumn<SalesReportItem>[] = [
    {
      header: 'Documento',
      sortValue: (item) => item.documentNumber ?? '',
      render: (item) => item.documentNumber ?? '—',
      className: 'text-[0.9375rem] font-semibold whitespace-nowrap',
    },
    {
      header: 'Fecha',
      sortValue: (item) => item.saleDate,
      render: (item) => {
        // Fix (05/08/2026): `item.saleDate` es un instante UTC real — tomar
        // sus primeros 10 caracteres (`slice(0, 10)`) asumia que ya
        // representaba el dia calendario de Costa Rica, y mostraba un dia
        // adelantado para cualquier venta hecha entre las 18:00 y las 23:59
        // hora de Costa Rica (confirmado con datos reales: VTA-000136 a
        // VTA-000168, hechas ~21-22h CR del 03/08, se etiquetaban como
        // 04/08). `formatDateTime` (`utils/formatDateTime.ts`) ya convierte
        // a hora de Costa Rica de forma correcta — se reutiliza esa unica
        // fuente de verdad y se descarta la hora (`" HH:mm"`) para no
        // cambiar el formato visual de esta columna (solo fecha, sin hora).
        return formatDateTime(item.saleDate).split(' ')[0]
      },
      className: 'text-muted-foreground whitespace-nowrap',
    },
    {
      header: 'Sucursal',
      sortValue: (item) => item.sucursal.name,
      render: (item) => item.sucursal.name,
      className: 'max-w-[9rem] truncate text-muted-foreground',
    },
    {
      header: 'Usuario',
      sortValue: (item) => item.user.fullName,
      render: (item) => item.user.fullName,
      className: 'max-w-[9rem] truncate text-muted-foreground',
    },
    {
      header: 'Método de pago',
      render: (item) => (
        <Badge variant="secondary">{getPaymentMethodLabel(item)}</Badge>
      ),
      className: 'align-middle whitespace-nowrap',
    },
    {
      // QA-007: referencia del pago electronico (numero de autorizacion/
      // voucher, comprobante SINPE o numero de transferencia). Nula para
      // CASH — se muestra "—", mismo criterio que el resto de campos
      // opcionales de esta tabla (`documentNumber`).
      header: 'Referencia',
      render: (item) => item.paymentReference ?? '—',
      className: 'max-w-[8rem] truncate text-muted-foreground',
    },
    {
      header: 'Subtotal',
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.subtotal),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Impuesto',
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.taxTotal),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Descuento',
      headerClassName: 'text-right',
      // Bloque "consistencia de descuentos": `discountAmount`/
      // `discountPercent` ya vienen calculados por el backend
      // (`reports.service.ts::getSalesReport`, incluye descuentos
      // manuales y promociones automáticas) — `formatDiscountCell` es el
      // mismo formateador que usan el detalle y el Historial de Ventas
      // (`features/sales/utils/saleDiscount.ts`), para que las 3
      // pantallas muestren exactamente el mismo texto.
      render: (item) =>
        formatDiscountCell({ amount: item.discountAmount, percent: item.discountPercent }),
      className: 'text-right whitespace-nowrap text-muted-foreground tabular-nums',
    },
    {
      header: 'Total',
      sortValue: (item) => item.total,
      headerClassName: 'text-right',
      render: (item) => formatCurrency(item.total),
      className: 'text-right whitespace-nowrap text-base font-semibold tabular-nums text-brand',
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
      headerClassName="py-4 text-xs font-semibold tracking-wide text-foreground/70 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="py-4"
      scrollX
    />
  )
}
