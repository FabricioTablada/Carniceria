import { formatCurrency } from '@/utils/formatCurrency'
import type { SaleAppliedPromotion, SaleItem } from '../types/sale.types'

/**
 * features/sales/utils/saleDiscount.ts
 * -----------------------------------------------------------------------------
 * Fuente ÚNICA de la lógica "cuánto se descontó realmente" (monto + si es
 * posible expresarlo como un único porcentaje), compartida por las 4
 * superficies que muestran descuentos de una venta: `SaleDetailContent.tsx`
 * (detalle), `SalesTable.tsx` (historial), `saleReceiptBuilder.ts`
 * (comprobante/PDF del POS) y, del lado del backend, el equivalente en
 * `reports.service.ts` para el Reporte de Ventas (misma regla, reescrita
 * ahí porque ese archivo no puede importar código del frontend).
 *
 * Por qué hace falta esto: `SaleItem.discount` es EXCLUSIVAMENTE el
 * descuento manual de esa línea — cuando una promoción automática ajusta
 * el precio, ese monto nunca vive ahí, solo en
 * `SaleAppliedPromotion.amountApplied` (filtrado por `saleItemId` para una
 * línea puntual, o la suma de todas las filas para la venta completa). El
 * descuento MANUAL de carrito (`Sale.discountTotal`) también tiene su
 * propia fila en `appliedPromotions` (`saleItemId: null`, `source:
 * 'MANUAL'`) — sumar `appliedPromotions[].amountApplied` ya lo incluye, no
 * hay que sumarlo aparte.
 *
 * Ningún cálculo de negocio se toca acá: esto solo LEE valores que el
 * motor de promociones y `sales.service.ts` ya persistieron.
 */

/** Un porcentaje real solo si `effectType` (promociones automáticas,
 * Bloque 3+) o, en su defecto, `discountType` (fallback para descuentos
 * manuales/ventas históricas) lo confirman como tal — mismo criterio ya
 * usado en la columna "Detalle" de "Descuentos aplicados". */
function isPercentagePromotion(promotion: SaleAppliedPromotion): boolean {
  return promotion.effectType
    ? promotion.effectType === 'PERCENTAGE'
    : promotion.discountType === 'PERCENTAGE'
}

export interface DiscountAmountAndPercent {
  amount: number
  /** Solo no-nulo cuando se puede determinar SIN ambigüedad — ver cada
   * función de abajo para el criterio exacto. */
  percent: number | null
}

/**
 * Descuento real de UNA línea: su descuento manual (`item.discount`) más
 * las promociones automáticas atadas a ella (`saleItemId === item.id`).
 *
 * El porcentaje solo se expone cuando hay una única fuente de descuento
 * sobre esa línea y es de tipo porcentual — sin descuento manual mezclado,
 * y exactamente una promoción automática. Con dos o más promociones (los
 * porcentajes no se suman linealmente) o con un monto manual de por medio,
 * un único "%" ya no describiría con exactitud cuánto se descontó, así que
 * se deja `null` (el llamador debe mostrar solo el monto).
 */
export function getLineItemDiscount(
  item: SaleItem,
  appliedPromotions: SaleAppliedPromotion[],
): DiscountAmountAndPercent {
  const linePromotions = appliedPromotions.filter(
    (promotion) => promotion.saleItemId === item.id,
  )
  const promotionAmount = linePromotions.reduce(
    (sum, promotion) => sum + promotion.amountApplied,
    0,
  )
  const amount = item.discount + promotionAmount

  const percent =
    item.discount === 0 && linePromotions.length === 1 && isPercentagePromotion(linePromotions[0])
      ? linePromotions[0].discountValue
      : null

  return { amount, percent }
}

/**
 * Descuento total de TODA la venta: suma de los descuentos manuales de
 * cada línea más todas las filas de `appliedPromotions` (carrito manual +
 * promociones automáticas, sin doble conteo — ver comentario de archivo).
 *
 * Mismo criterio de "único porcentaje" que `getLineItemDiscount`, aplicado
 * a nivel de venta completa: ningún descuento manual de línea y
 * exactamente UNA fila en `appliedPromotions`, de tipo porcentual.
 */
export function getSaleTotalDiscount(
  items: SaleItem[],
  appliedPromotions: SaleAppliedPromotion[],
): DiscountAmountAndPercent {
  const lineDiscountTotal = items.reduce((sum, item) => sum + item.discount, 0)
  const promotionAmountTotal = appliedPromotions.reduce(
    (sum, promotion) => sum + promotion.amountApplied,
    0,
  )
  const amount = lineDiscountTotal + promotionAmountTotal

  const percent =
    lineDiscountTotal === 0 &&
    appliedPromotions.length === 1 &&
    isPercentagePromotion(appliedPromotions[0])
      ? appliedPromotions[0].discountValue
      : null

  return { amount, percent }
}

/**
 * Formato compartido para cualquier celda/campo de descuento del módulo de
 * Ventas: "—" sin descuento, `"10% · -₡2.160"` cuando el porcentaje es
 * determinable, `"-₡2.160"` en cualquier otro caso.
 */
export function formatDiscountCell(discount: DiscountAmountAndPercent): string {
  if (discount.amount <= 0) {
    return '—'
  }

  return discount.percent !== null
    ? `${discount.percent}% · -${formatCurrency(discount.amount)}`
    : `-${formatCurrency(discount.amount)}`
}
