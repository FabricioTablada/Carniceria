import type { PaymentMethod } from '../types/sale.types'

/**
 * features/sales/utils/payment.ts
 * -----------------------------------------------------------------------------
 * QA-007: metodos de pago que exigen una referencia antes de confirmar la
 * venta — mismo criterio (y misma lista) que `ELECTRONIC_PAYMENT_METHODS`
 * en `modules/sales/validation.ts` del backend, que es quien realmente
 * hace cumplir la regla; esta lista en el frontend solo evita el viaje de
 * red para el caso invalido (mismo patron ya usado con
 * `hasInvalidDiscount` en `SalesPOSPage.tsx`). Deliberadamente sin
 * `MIXED` — mismo motivo que en el backend: un pago mixto no tiene una
 * unica referencia bien definida.
 */
export const ELECTRONIC_PAYMENT_METHODS: PaymentMethod[] = ['CARD', 'SINPE_MOVIL', 'TRANSFER']

/** Opciones de metodo de pago (valor + etiqueta) — antes vivia exportada
 * desde `CheckoutPanel.tsx` (violaba `react-refresh/only-export-components`,
 * ese archivo ya exporta un componente); se mueve aca junto al resto de
 * constantes de metodo de pago. `SaleConfirmDialog.tsx` la usa para
 * resolver la etiqueta del metodo elegido en el resumen de confirmacion,
 * sin duplicar este mapeo. Los iconos de cada tarjeta (rediseño del POS)
 * NO viven aca — son componentes, y ese mismo motivo de Fast Refresh
 * aplicaria si se exportaran junto al resto: quedan locales a
 * `CheckoutPanel.tsx` (`PAYMENT_METHOD_ICONS`, no exportado). */
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'SINPE_MOVIL', label: 'SINPE Móvil' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'MIXED', label: 'Mixto' },
]

/** Denominaciones reales de billetes en circulación en Costa Rica
 * (colones). Bloque "Modo Cobrar" (aprobado, "montos rápidos ya no deben
 * ser fijos"): antes `CheckoutPanel.tsx` mostraba 3 valores fijos
 * (₡5.000/₡10.000/₡20.000) sin relación al total de la venta. */
const CRC_BILL_DENOMINATIONS = [1000, 2000, 5000, 10000, 20000, 50000]

/**
 * Calcula 3 montos "rápidos" sugeridos a partir del total de la venta —
 * el billete inmediato superior y los 2 siguientes (mismo criterio que
 * cualquier caja registradora real: "¿con qué billete redondo se puede
 * pagar esto?"). Puramente presentacional (igual que los valores fijos
 * que reemplaza): cada resultado solo se usa para pre-llenar el mismo
 * campo `amountPaid` que el cajero podría tipear a mano, sin ningún
 * cálculo de negocio nuevo ni viaje al backend.
 */
export function getQuickCashAmounts(total: number): number[] {
  const roundedTotal = Math.max(0, Math.ceil(total))
  const billsAtOrAbove = CRC_BILL_DENOMINATIONS.filter((bill) => bill >= roundedTotal)

  if (billsAtOrAbove.length >= 3) {
    return billsAtOrAbove.slice(0, 3)
  }

  // Bloque 7.28: quedan menos de 3 billetes reales en `billsAtOrAbove`
  // (total entre ₡10.001 y ₡50.000 inclusive) — se completan las
  // sugerencias restantes con multiplos de ₡50.000. El multiplicador
  // arranca DESPUES del mayor monto ya presente en `billsAtOrAbove` (no a
  // partir de `roundedTotal` directamente, como antes) — `roundedTotal`
  // puede ser menor que ese billete de ₡50.000 ya incluido, lo que
  // producia un multiplicador que regeneraba exactamente el mismo ₡50.000
  // ya sugerido (causa raiz real y demostrada del bug de montos
  // duplicados). Cuando `billsAtOrAbove` esta vacio (total ya supera el
  // billete mas grande en circulacion) se usa `roundedTotal` como base,
  // igual que antes — ese caso nunca tuvo el bug.
  const largestBill = CRC_BILL_DENOMINATIONS[CRC_BILL_DENOMINATIONS.length - 1]
  const suggestions = [...billsAtOrAbove]
  const largestSuggestedSoFar =
    suggestions.length > 0 ? suggestions[suggestions.length - 1] : roundedTotal
  let multiplier = Math.floor(largestSuggestedSoFar / largestBill) + 1
  while (suggestions.length < 3) {
    suggestions.push(largestBill * multiplier)
    multiplier += 1
  }
  return suggestions
}
