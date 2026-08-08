import type { ReactNode } from 'react'
import { CreditCard, Package, Scale, Tag } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatQuantity } from '@/utils/formatQuantity'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import type { Sale } from '../types/sale.types'

interface SalePaymentPanelProps {
  sale: Sale
}

function PanelRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * features/sales/components/SalePaymentPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Ventas — panel lateral de la pestaña "Productos y pagos":
 * resumen ejecutivo, no una segunda tabla. Todo derivado de `Sale` ya
 * cargado por `useSale` (mismo dato que ya alimenta la tabla de productos
 * y la tabla de promociones de esta misma pestaña) — sin ninguna consulta
 * ni cálculo nuevo:
 *  - "Descuentos manuales" reutiliza `getSaleTotalDiscount` (`utils/saleDiscount.ts`,
 *    ya usado por `SalesTable.tsx`) para separar el descuento manual de
 *    carrito del total de promociones automáticas.
 *  - "Cantidad total"/"Peso total" se derivan de `sale.items`, agrupando
 *    por `unitOfMeasure` (mismo campo que ya usa `formatQuantity` en la
 *    tabla de productos).
 *
 * Corrección de consistencia (aprobado, "el panel lateral debe ocupar
 * únicamente el ancho mínimo indispensable — la tabla de productos debe
 * ser la protagonista"): `@lg:w-72` (18rem) → `@lg:w-52` (13rem) — mismo
 * contenido, mismas 3 tarjetas. Para que ese ancho no rompa el ajuste de
 * línea, "Promociones automáticas"/"Líneas de producto"/"Unidades
 * vendidas" se acortan a "Automáticas"/"Líneas"/"Unidades" (el título de
 * cada tarjeta — "Descuentos"/"Volumen de la venta" — ya da el contexto
 * que el texto largo repetía) — mismos valores/cálculos de siempre, solo
 * la etiqueta.
 *
 * Causa raíz del recorte de la columna "Total" de la tabla de Productos
 * (ver informe del bloque, `SaleDetailContent.tsx`): el quiebre a
 * angosto/lado-a-lado de ESTE panel debe coincidir SIEMPRE con el del
 * contenedor padre — pasa de `@lg` a `@7xl` junto con él. Como
 * consecuencia, este panel ahora pasa mucho más tiempo en su estado
 * "ancho completo" (apilado debajo de la tabla) que antes — para que eso
 * no signifique 3 tarjetas apiladas verticalmente ocupando alto de más,
 * sus 3 tarjetas se reacomodan en fila (`@xl:flex-row`, mismo contexto de
 * `@container` que ya usa el resto de esta vista) mientras el panel está
 * a ancho completo, y vuelven a apilarse verticalmente (`@7xl:flex-col`)
 * en el momento exacto en que el panel se angosta a su ancho fijo de
 * barra lateral — sin este último paso, las 3 tarjetas intentarían ir en
 * fila DENTRO de esos 13rem y se apretarían.
 */
export function SalePaymentPanel({ sale }: SalePaymentPanelProps) {
  const paymentMethodLabel =
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === sale.paymentMethod)?.label ??
    sale.paymentMethod

  // Rediseño de Ventas: "Manual" = descuento de línea (`item.discount`) +
  // la fila de carrito manual dentro de `appliedPromotions` (`source ===
  // 'MANUAL'`, `saleItemId: null`) — mismo criterio ya documentado en
  // `utils/saleDiscount.ts` ("el descuento MANUAL de carrito también
  // tiene su propia fila en appliedPromotions"). "Automáticas" = el resto
  // (promociones reales del motor). Sin sumar dos veces: son particiones
  // disjuntas de `sale.appliedPromotions`.
  const manualPromotions = sale.appliedPromotions.filter((promotion) => promotion.source === 'MANUAL')
  const automaticPromotions = sale.appliedPromotions.filter(
    (promotion) => promotion.source !== 'MANUAL',
  )
  const lineDiscountTotal = sale.items.reduce((sum, item) => sum + item.discount, 0)
  const manualDiscountTotal =
    lineDiscountTotal + manualPromotions.reduce((sum, promotion) => sum + promotion.amountApplied, 0)
  const automaticPromotionsTotal = automaticPromotions.reduce(
    (sum, promotion) => sum + promotion.amountApplied,
    0,
  )

  const totalUnits = sale.items
    .filter((item) => item.product.unitOfMeasure === 'UNIT')
    .reduce((sum, item) => sum + item.quantity, 0)
  const totalWeight = sale.items
    .filter((item) => item.product.unitOfMeasure === 'KILOGRAM')
    .reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="flex w-full flex-col gap-4 @xl:flex-row @7xl:w-52 @7xl:shrink-0 @7xl:flex-col">
      <div className="min-w-0 flex-none rounded-xl border bg-card p-4 shadow-sm @xl:flex-1 @7xl:flex-none">
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <CreditCard className="size-3.5" />
          Resumen del pago
        </h3>
        <div className="divide-y divide-border">
          <PanelRow label="Método" value={paymentMethodLabel} />
          <PanelRow label="Referencia" value={sale.paymentReference ?? '—'} />
          <PanelRow label="Monto pagado" value={formatCurrency(sale.amountPaid)} />
          {sale.changeGiven > 0 && <PanelRow label="Vuelto" value={formatCurrency(sale.changeGiven)} />}
        </div>
      </div>

      <div className="min-w-0 flex-none rounded-xl border bg-card p-4 shadow-sm @xl:flex-1 @7xl:flex-none">
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Tag className="size-3.5" />
          Descuentos
        </h3>
        <div className="divide-y divide-border">
          <PanelRow label="Manual" value={manualDiscountTotal > 0 ? formatCurrency(manualDiscountTotal) : '—'} />
          <PanelRow
            label="Automáticas"
            value={
              automaticPromotions.length > 0 ? (
                <Badge variant="accent">{formatCurrency(automaticPromotionsTotal)}</Badge>
              ) : (
                '—'
              )
            }
          />
        </div>
      </div>

      <div className="min-w-0 flex-none rounded-xl border bg-card p-4 shadow-sm @xl:flex-1 @7xl:flex-none">
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Package className="size-3.5" />
          Volumen de la venta
        </h3>
        <div className="divide-y divide-border">
          <PanelRow label="Líneas" value={sale.items.length} />
          {totalUnits > 0 && <PanelRow label="Unidades" value={formatQuantity(totalUnits, 'UNIT')} />}
          {totalWeight > 0 && (
            <PanelRow
              label={
                <span className="flex items-center gap-1">
                  <Scale className="size-3" />
                  Peso total
                </span>
              }
              value={formatQuantity(totalWeight, 'KILOGRAM')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
