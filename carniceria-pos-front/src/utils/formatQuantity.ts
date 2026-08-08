/**
 * utils/formatQuantity.ts
 * -----------------------------------------------------------------------------
 * Formatea una cantidad con su unidad de medida ("kg"/"u."), mismo criterio
 * que `formatCurrency.ts` (utilidad compartida, sin dependencias externas).
 *
 * `unitOfMeasure` es la unica fuente de verdad para decidir el formato
 * (aprobado): `KILOGRAM` se muestra con hasta 3 decimales (coherente con
 * `Decimal(12,3)` del backend — precision de gramos) y sufijo "kg";
 * `UNIT` se redondea a entero con sufijo "u.". No se mezcla con
 * `isVariableWeight` (reservado para una futura integracion de codigos de
 * bascula, sin relacion con este formato).
 */

export type QuantityUnit = 'UNIT' | 'KILOGRAM'

/**
 * Formatea `value` como cantidad con unidad (ej. `12.5` + `'KILOGRAM'` ->
 * `"12.500 kg"`; `3` + `'UNIT'` -> `"3 u."`). Si `value` no es un numero
 * finito, devuelve un guion en vez de un texto sin sentido.
 */
export function formatQuantity(value: number, unitOfMeasure: QuantityUnit): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  if (unitOfMeasure === 'KILOGRAM') {
    return `${value.toFixed(3)} kg`
  }

  return `${Math.round(value)} u.`
}

/**
 * Redondea `value` a la misma precisión que `formatQuantity` MUESTRA para
 * `unitOfMeasure` (3 decimales para `KILOGRAM` — igual que `Decimal(12,3)`
 * en `schema.prisma` — o entero para `UNIT`).
 *
 * Existe porque un limite de validacion (ej. "no superar el stock
 * disponible") debe compararse siempre contra la MISMA precision que el
 * usuario ve en pantalla — mismo criterio ya aplicado en
 * `PurchaseItemRow.tsx` (`roundTo2`, redondea a 2 decimales "para evitar
 * arrastre de coma flotante al incrementar/decrementar"), generalizado
 * aca a las dos unidades reales de Inventario en vez de un valor fijo de
 * moneda. Sin esto, un stock que displaya como "20.000 kg" pero cuyo valor
 * crudo en JS conserva un residuo de punto flotante (ej. 19.999999999999996,
 * indistinguible a simple vista de 20) rechaza como invalida una cantidad
 * que el usuario, guiado por lo que ve, considera perfectamente valida.
 */
export function roundToUnitPrecision(value: number, unitOfMeasure: QuantityUnit): number {
  if (unitOfMeasure === 'KILOGRAM') {
    return Math.round(value * 1000) / 1000
  }

  return Math.round(value)
}

/**
 * Sufijo visual de unidad ("kg"/"u."), el mismo que ya usa `formatQuantity`
 * internamente — expuesto por separado para los formularios de captura
 * (`InventoryAdjustForm.tsx`, `SaleCorrectForm.tsx`, etc.) que necesitan
 * mostrar el sufijo junto a un `<input>` en vez de un valor ya formateado
 * como texto (`formatQuantity` arma la cadena completa "12.500 kg"; esto
 * es solo la palabra, para no repetir el literal `'kg'`/`'u.'` en cada
 * formulario).
 */
export function getUnitSuffix(unitOfMeasure: QuantityUnit): string {
  return unitOfMeasure === 'KILOGRAM' ? 'kg' : 'u.'
}

/**
 * `step` de HTML correcto para un `<input type="number">` segun la unidad
 * (0.001 para `KILOGRAM`, coherente con `Decimal(12,3)`; 1 para `UNIT`,
 * sin decimales). Centraliza la regla `unitOfMeasure === 'KILOGRAM' ?
 * 0.001 : 1` que hoy esta repetida de forma identica en
 * `InventoryWasteForm.tsx`, `SaleCorrectForm.tsx` y `SaleReturnForm.tsx` —
 * un solo lugar evita que un formulario nuevo (o uno editado a mano)
 * quede con un `step` distinto por descuido, como ya le paso a
 * `InventoryAdjustForm.tsx` (`step="0.01"` fijo, sin distincion por
 * unidad).
 */
export function getQuantityStep(unitOfMeasure: QuantityUnit): number {
  return unitOfMeasure === 'KILOGRAM' ? 0.001 : 1
}
