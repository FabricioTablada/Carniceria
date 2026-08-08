import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { ERP_ORGANIZATION } from '../constants/organization'
import type { DocumentData, DocumentItem, DocumentType } from '../types/document.types'

interface DocumentRendererProps {
  data: DocumentData
  /** Bloque 6.3 (modal "Venta completada"): reduce ~10-15% los paddings y
   * espacios verticales propios de este componente (colores/tipografía/
   * estructura intactos). Default `false` — comportamiento IDÉNTICO al
   * actual para `PurchaseDetailPage.tsx` y `SaleDetailContent.tsx`, que no
   * pasan esta prop. Activado únicamente desde `SaleReceiptDialog.tsx`. */
  compact?: boolean
  /** Bloque 6.3: cuando se define, la tabla de "Detalle" recibe su propio
   * scroll interno acotado a esta altura máxima (valor CSS, ej. "20rem"),
   * en vez de depender de que el contenedor que envuelve a todo el
   * documento (el `Popup` de `SaleReceiptDialog.tsx`) tenga scroll único.
   * Default `undefined` — sin este prop la tabla no tiene scroll propio,
   * comportamiento IDÉNTICO al actual para los demás consumidores. */
  detailMaxHeight?: string
}

/** Document Design System (aprobado): título del documento en español —
 * antes se imprimía el `DocumentType` crudo (ej. "PURCHASE_ORDER"). Mapa
 * puramente de presentación (una etiqueta por tipo), el motor sigue sin
 * conocer ningún dominio — mismo criterio que `STATUS_LABELS` de cada
 * Builder (`purchaseOrderBuilder.ts`, etc.), solo que este vive en el
 * motor porque `DocumentType` también vive ahí. Cubre los 9 valores ya
 * declarados en `document.types.ts`, incluidos los que todavía no tienen
 * un Builder real (Facturas/Cotizaciones/Devoluciones/Notas) — la base
 * queda lista para cuando los tengan. */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALE_RECEIPT: 'Comprobante de Venta',
  PURCHASE_ORDER: 'Orden de Compra',
  CASH_MOVEMENT: 'Movimiento de Caja',
  INVENTORY_MOVEMENT: 'Movimiento de Inventario',
  RETURN: 'Devolución',
  QUOTE: 'Cotización',
  ORDER: 'Pedido',
  CREDIT_NOTE: 'Nota de Crédito',
  DEBIT_NOTE: 'Nota de Débito',
}

/** Bloque de "etiqueta arriba, valor abajo" — mismo patron de lectura
 * usado en el resto del ERP para datos generales (ej. `KpiCard`), pero sin
 * importar ese componente: `DocumentRenderer` no depende de ningun otro
 * componente de la aplicacion, solo de `DocumentData`. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  )
}

/** Mismo formato de texto que `features/sales/utils/saleDiscount.ts`
 * (`formatDiscountCell`) — reimplementado aquí, sin importarlo, porque
 * `documents` es un motor genérico (no depende del dominio de Ventas); el
 * CÁLCULO de cuánto/qué porcentaje descontar sigue viviendo exclusivamente
 * en los builders de cada dominio (`saleReceiptBuilder.ts`), este helper
 * solo da formato a los dos números ya resueltos. */
function formatDiscount(amount?: number, percent?: number | null): string {
  if (!amount) {
    return '—'
  }

  return percent != null ? `${percent}% · -${formatCurrency(amount)}` : `-${formatCurrency(amount)}`
}

function ItemRow({
  item,
  index,
  compact,
  fixedWidth,
}: {
  item: DocumentItem
  index: number
  compact?: boolean
  fixedWidth?: boolean
}) {
  // Bloque 6.3 (ajuste): con `fixedWidth` (columnas de ancho fijo, ver
  // `<colgroup>` mas abajo) el texto puede envolver a una segunda linea en
  // vez de forzar scroll horizontal — `whitespace-nowrap` es exactamente
  // lo que causaba que la tabla se ensanchara mas alla del contenedor.
  const cellClassName = cn(
    'text-right text-sm tabular-nums text-muted-foreground',
    fixedWidth ? 'break-words' : 'whitespace-nowrap',
    compact ? 'px-3.5 py-2.5' : 'px-4 py-3',
  )

  return (
    <tr className={index % 2 === 1 ? 'bg-muted/25' : undefined}>
      {/* Bloque 6.3 (ajuste): "Descripción" NO recibe `break-words` — ese
          era el causante de que las palabras se partieran letra por letra
          cuando la columna quedaba angosta. Con la columna recuperando la
          mayor parte del ancho (ver `<colgroup>` mas abajo), el ajuste de
          linea por defecto en los espacios ya alcanza, igual que antes de
          este bloque. */}
      <td className={cn('text-sm text-foreground', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
        {item.label}
      </td>
      <td className={cellClassName}>
        {item.quantity}
        {item.unit ? ` ${item.unit}` : ''}
      </td>
      <td className={cellClassName}>{formatCurrency(item.unitPrice)}</td>
      <td className={cellClassName}>{formatDiscount(item.discount, item.discountPercent)}</td>
      <td className={cellClassName}>
        {item.tax ? (
          <div className="flex flex-col items-end">
            <span>
              {item.tax.label} ({item.tax.rate}%)
            </span>
            <span className="text-xs">{formatCurrency(item.tax.amount)}</span>
          </div>
        ) : (
          '—'
        )}
      </td>
      <td
        className={cn(
          'text-right text-sm font-semibold tabular-nums text-foreground',
          fixedWidth ? 'break-words' : 'whitespace-nowrap',
          compact ? 'px-3.5 py-2.5' : 'px-4 py-3',
        )}
      >
        {formatCurrency(item.total)}
      </td>
    </tr>
  )
}

/**
 * features/documents/components/DocumentRenderer.tsx
 * -----------------------------------------------------------------------------
 * Bloque 13.4 — componente oficial del Motor de Documentos. Unica
 * responsabilidad: recibir un `DocumentData` (ya construido por un
 * `DocumentBuilder` del backend, `modules/documents`) y representarlo
 * visualmente. Sin hooks, sin llamadas a API, sin estado, sin logica de
 * negocio — una funcion pura de `DocumentData` a JSX.
 *
 * Reutilizable por cualquier modulo del ERP (Ventas, Compras, Caja,
 * Inventario, Devoluciones, Cotizaciones, Pedidos, Notas de credito/debito):
 * ninguna parte de este archivo conoce `Sale`, `Purchase` ni ningun otro
 * tipo de dominio — solo los campos genericos de `DocumentData`
 * (`features/documents/types/document.types.ts`, Bloque 13.1).
 *
 * Sin botones/acciones propias a proposito (ver Bloque 13.6 mas abajo) —
 * "Imprimir"/"Descargar PDF" viven en quien lo use (`SaleReceiptDialog.tsx`,
 * `PurchaseDetailPage.tsx`, via el hook compartido `use*DocumentActions`).
 *
 * Bloque 13.6 (impresion): `data-document-print-root` en el nodo raiz es el
 * UNICO enganche con la hoja de estilos de impresion (`index.css`, `@media
 * print`) — ese selector oculta todo lo demas de la pagina y muestra
 * unicamente este componente. No hay una plantilla de impresion separada:
 * es el mismo JSX que se ve en pantalla, con `window.print()` disparado por
 * quien use este componente. Sin cambios en este bloque — la impresión
 * sigue heredando automáticamente todo lo modernizado acá.
 *
 * Document Design System (aprobado, "base reutilizable para todos los
 * documentos futuros del ERP"): rediseño completo del encabezado, la
 * tabla y el bloque de totales con lenguaje visual corporativo — mismos
 * tokens del Design System (`--brand`, `tabular-nums`, radios/espaciados
 * ya usados en el resto del ERP), CERO lógica nueva:
 *  - Encabezado: `ERP_ORGANIZATION` (constante fija, `constants/
 *    organization.ts`) como identidad de marca — nombre comercial +
 *    espacio de logo ya reservado (`logoUrl`, hoy `null`) — separada de
 *    `data.company` (el PUNTO DE EMISIÓN real del documento — sucursal/
 *    almacén/caja, ya resuelto por cada Builder), que ahora se etiqueta
 *    explícitamente "Sucursal" en vez de mezclarse con el nombre de la
 *    empresa. Título del documento traducido (`DOCUMENT_TYPE_LABELS`,
 *    nunca el enum crudo) + Estado como chip con punto de color (antes
 *    texto plano) + fecha ya formateada (`formatDateTime`, nunca ISO).
 *  - Tabla: encabezado con fondo distintivo (`bg-brand/5`), filas en
 *    zebra sutil, más padding (`px-4 py-3`, antes `px-3 py-2`) — mismo
 *    criterio de "buen espaciado, alineaciones correctas" ya establecido
 *    en las tablas administrativas del ERP (`DataTable.tsx`).
 *  - Totales: el `Total` pasa a un bloque "hero" con tinte de marca —
 *    mismo tratamiento visual que "Total comprado"
 *    (`SupplierCommercialCard.tsx`) / "Existencia actual"
 *    (`InventoryAdjustDrawer.tsx`) / el hero de `PurchaseDetailPage.tsx` —
 *    en vez de una línea más entre Subtotal/Impuestos.
 *  - Pie institucional nuevo: nombre de la empresa + leyenda/notas ya
 *    existentes, con jerarquía tipográfica más discreta.
 * Ningún campo de `DocumentData` se agrega/quita — mismos datos de
 * siempre, solo composición visual.
 */
export function DocumentRenderer({ data, compact = false, detailMaxHeight }: DocumentRendererProps) {
  const { document, company, customer, issuedBy, items, totals, payments, footer } = data
  const documentTypeLabel = DOCUMENT_TYPE_LABELS[document.type] ?? document.type

  return (
    // `@container`: los `@sm:` de mas abajo responden al ancho REAL de
    // este componente (quien lo embeba puede ser un Dialog angosto o un
    // panel ancho), no al viewport — mismo criterio ya establecido en el
    // resto del ERP para vistas de detalle.
    <div
      data-document-print-root
      className={cn(
        '@container flex flex-col rounded-2xl border bg-card text-foreground shadow-sm',
        compact ? 'gap-7 p-7 @sm:p-9' : 'gap-8 p-8 @sm:p-10',
      )}
    >
      {/* Encabezado corporativo: identidad de marca a la izquierda, datos
          del documento a la derecha. */}
      <header
        className={cn(
          'flex flex-col border-b-2 border-brand/15 @sm:flex-row @sm:items-start @sm:justify-between',
          compact ? 'gap-5 pb-5' : 'gap-6 pb-6',
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
            {ERP_ORGANIZATION.logoUrl ? (
              <img src={ERP_ORGANIZATION.logoUrl} alt={ERP_ORGANIZATION.name} className="size-full object-cover" />
            ) : (
              <Building2 className="size-7" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold tracking-tight text-foreground">
              {ERP_ORGANIZATION.name}
            </span>
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground/80">Sucursal:</span> {company.name}
              </span>
              {company.identifier && <span>{company.identifier}</span>}
              {(company.address || company.location) && (
                <span>{[company.address, company.location].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5 @sm:items-end @sm:text-right">
          <span className="text-xs font-semibold tracking-wide text-brand uppercase">
            {documentTypeLabel}
          </span>
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {document.number ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-brand" />
            {document.status}
          </span>
          <span className="text-sm text-muted-foreground">{formatDateTime(document.issuedAt)}</span>
          {document.reference && (
            <span className="text-xs text-muted-foreground">Ref. {document.reference}</span>
          )}
        </div>
      </header>

      {/* Contraparte + responsable */}
      <div className={cn('grid grid-cols-1 @sm:grid-cols-2', compact ? 'gap-3.5' : 'gap-4')}>
        <div className={cn('flex flex-col gap-3 rounded-xl bg-muted/40', compact ? 'p-3.5' : 'p-4')}>
          <SectionTitle>{customer.identifier ? 'Proveedor' : 'Cliente'}</SectionTitle>
          <Field label="Nombre" value={customer.name} />
          {customer.identifier && <Field label="Identificación" value={customer.identifier} />}
        </div>

        <div className={cn('flex flex-col gap-3 rounded-xl bg-muted/40', compact ? 'p-3.5' : 'p-4')}>
          <SectionTitle>Responsable</SectionTitle>
          <Field label="Emitido por" value={issuedBy.name} />
        </div>
      </div>

      {/* Tabla de items. Bloque 6.3: cuando `detailMaxHeight` está definido,
          este es el único contenedor con scroll interno propio (marcado con
          `data-document-detail-scroll` para que la hoja de estilos de
          impresión lo pueda resetear explícitamente — ver `index.css`,
          `@media print`, ya que al ser un DESCENDIENTE de
          `[data-document-print-root]` la regla existente basada en
          `*:has(...)`, pensada para ANCESTROS, no lo alcanza). */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Detalle</SectionTitle>
        <div
          data-document-detail-scroll={detailMaxHeight ? '' : undefined}
          className={cn('rounded-xl border', detailMaxHeight ? 'overflow-x-hidden overflow-y-auto' : 'overflow-hidden')}
          style={detailMaxHeight ? { maxHeight: detailMaxHeight } : undefined}
        >
          {/* Bloque 6.3 (ajuste): `table-fixed` + `<colgroup>` evita el
              scroll horizontal (garantiza que las 6 columnas sumen 100% del
              ancho del contenedor, nunca mas). Los 5 anchos en `px` son
              SOLO el minimo necesario para que su contenido usual ("1
              UNIT", "IVA 13%", montos tipicos) entre en una linea sin
              partirse — "Descripción" no declara ancho propio y absorbe
              automaticamente TODO el espacio restante (comportamiento
              estandar de `table-layout: fixed`), igual que ocupaba la
              mayor parte del ancho antes de este bloque. Sin
              `detailMaxHeight` (demas consumidores) la tabla conserva su
              layout `auto` de siempre, sin `colgroup`. */}
          <table className={cn('w-full', detailMaxHeight && 'table-fixed')}>
            {detailMaxHeight && (
              <colgroup>
                <col />
                <col style={{ width: '90px' }} />
                <col style={{ width: '95px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '95px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
            )}
            <thead>
              <tr className="border-b bg-brand/5">
                <th className={cn('text-left text-xs font-semibold tracking-wide text-foreground/85 uppercase', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
                  Descripción
                </th>
                <th className={cn('text-right text-xs font-semibold tracking-wide text-foreground/85 uppercase', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
                  Cantidad
                </th>
                <th className={cn('text-right text-xs font-semibold tracking-wide text-foreground/85 uppercase', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
                  Precio unitario
                </th>
                <th className={cn('text-right text-xs font-semibold tracking-wide text-foreground/85 uppercase', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
                  Descuento
                </th>
                <th className={cn('text-right text-xs font-semibold tracking-wide text-foreground/85 uppercase', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
                  Impuesto
                </th>
                <th className={cn('text-right text-xs font-semibold tracking-wide text-foreground/85 uppercase', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                // DocumentItem no trae un id propio (es generico, no una
                // entidad persistida) — el indice es estable aca porque
                // `items` no se reordena/filtra en vivo, solo se renderiza.
                <ItemRow
                  key={index}
                  item={item}
                  index={index}
                  compact={compact}
                  fixedWidth={Boolean(detailMaxHeight)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales + pagos, alineados a la derecha estilo factura — el Total
          es el elemento protagonista (bloque hero con tinte de marca). */}
      <div className={cn('flex flex-col @sm:flex-row @sm:justify-end', compact ? 'gap-3.5' : 'gap-4')}>
        {payments && payments.length > 0 && (
          <div className={cn('flex flex-col gap-1.5 rounded-xl border text-sm @sm:w-64', compact ? 'p-3.5' : 'p-4')}>
            <SectionTitle>Pagos</SectionTitle>
            {payments.map((payment, index) => (
              // DocumentPayment tampoco trae un id propio, mismo criterio.
              <div key={index} className="flex items-center justify-between">
                <span className="text-muted-foreground">{payment.method}</span>
                <span className="tabular-nums">{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 @sm:w-72">
          <div className={cn('flex flex-col gap-1.5 rounded-xl bg-muted/40 text-sm', compact ? 'p-3.5' : 'p-4')}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Descuentos</span>
              <span className="tabular-nums">
                {formatDiscount(totals.discount, totals.discountPercent)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Impuestos</span>
              <span className="tabular-nums">{totals.tax ? formatCurrency(totals.tax) : '—'}</span>
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-between rounded-xl border border-brand/15 bg-brand/5',
              compact ? 'px-3.5 py-3' : 'px-4 py-3.5',
            )}
          >
            <span className="text-sm font-semibold tracking-wide text-brand/80 uppercase">Total</span>
            <span className="text-2xl leading-none font-extrabold tabular-nums text-brand">
              {formatCurrency(totals.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Notas + pie institucional del documento */}
      {(footer?.notes || footer?.legalText) && (
        <div className={cn('flex flex-col gap-2 border-t', compact ? 'pt-3.5' : 'pt-4')}>
          {footer.notes && (
            <div className="flex flex-col gap-0.5">
              <SectionTitle>Notas</SectionTitle>
              <p className="text-sm text-muted-foreground">{footer.notes}</p>
            </div>
          )}
          {footer.legalText && (
            <p className="text-xs text-muted-foreground">{footer.legalText}</p>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col items-center gap-0.5 border-t text-center text-xs text-muted-foreground',
          compact ? 'pt-3.5' : 'pt-4',
        )}
      >
        <span className="font-semibold text-foreground/70">{ERP_ORGANIZATION.name}</span>
        <span>Documento generado por el sistema — {documentTypeLabel}</span>
      </div>
    </div>
  )
}
