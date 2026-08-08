import type { SaleReturn } from '../types/return.types'

/**
 * features/returns/utils/returnedQuantity.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 1 (estabilizacion). Extraido de `SaleReturnHistory.tsx`
 * (Bloque 4.4), donde este calculo ya vivia inline — ahora tambien lo
 * necesita `SaleReturnForm.tsx` (Bloque 4.3) para acotar la cantidad
 * maxima devolvible por linea al REMANENTE real (cantidad original menos
 * lo ya devuelto en devoluciones previas), no a la cantidad original
 * completa. Antes de este fix, el formulario permitia seleccionar hasta
 * la cantidad original de una linea YA totalmente devuelta, y el envio
 * fallaba recien contra la validacion del backend (Bloque 4.2) sin que el
 * cliente supiera de antemano cuanto quedaba realmente disponible. Una
 * sola funcion, dos consumidores — sin duplicar el calculo.
 */
export function sumReturnedQuantityByItemId(returns: SaleReturn[]): Map<string, number> {
  const returnedQuantityByItemId = new Map<string, number>()

  for (const saleReturn of returns) {
    for (const item of saleReturn.items) {
      returnedQuantityByItemId.set(
        item.saleItemId,
        (returnedQuantityByItemId.get(item.saleItemId) ?? 0) + item.quantity,
      )
    }
  }

  return returnedQuantityByItemId
}
