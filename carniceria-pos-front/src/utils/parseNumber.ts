/**
 * utils/parseNumber.ts
 * -----------------------------------------------------------------------------
 * QA de UX de campos numericos monetarios: convierte un string tipeado por
 * el usuario a `number` UNICAMENTE en el momento en que ese numero hace
 * falta para calcular (subtotal, total) o para construir el DTO de envio —
 * nunca dentro de un `onChange` cuyo resultado se use como `value` del
 * input (eso es lo que rompia la escritura de decimales: `Number("5500.")`
 * da `5500`, sin el punto, y React vuelve a mostrar "5500", borrando lo que
 * el usuario acaba de tipear).
 *
 * Extraido de `SaleCorrectForm.tsx` (Bloque 1) para que `PurchaseItemRow.tsx`
 * (Bloque 2) no duplique la misma funcion.
 */
export function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
