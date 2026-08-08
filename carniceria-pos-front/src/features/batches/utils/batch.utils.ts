/**
 * features/batches/utils/batch.utils.ts
 * -----------------------------------------------------------------------------
 * Helpers del modulo Lotes que no son forma de datos (types.ts), regla de
 * validacion (schema.ts) ni componente.
 */

/** Formatea una fecha-solo (ISO string, con o sin hora) como `"DD/MM/YYYY"`.
 * No usa `new Date()` (sujeto a la zona horaria del navegador) — recorta el
 * string a los primeros 10 caracteres (`"YYYY-MM-DD"`) y reordena, mismo
 * criterio ya usado en `purchases/utils/purchase.utils.ts::formatPurchaseDate`.
 * Devuelve `'—'` para `null`/`undefined`. */
export function formatBatchDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/**
 * Rediseño de Inventario — "días restantes" (`BatchesTable.tsx`) y
 * "próximos a vencer" (`BatchesKpiRow.tsx`): días de calendario entre hoy
 * y `expiryDate` (fecha-solo, mismo criterio sin `new Date()` sujeto a
 * huso horario que `formatBatchDate`). `null` cuando el lote no tiene
 * fecha de vencimiento. Negativo cuando ya venció.
 */
export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) {
    return null
  }

  const [year, month, day] = expiryDate.slice(0, 10).split('-').map(Number)
  const expiry = Date.UTC(year, month - 1, day)

  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  return Math.round((expiry - today) / (1000 * 60 * 60 * 24))
}

/** Rediseño de Inventario: cuántos lotes de `batches` vencen dentro de
 * `withinDays` días (por defecto 7, mismo umbral ya usado en
 * `BatchesTable.tsx`) — un solo lugar para este conteo, reutilizado por
 * `BatchesKpiRow.tsx` y `InventoryKpiRow.tsx` (workspace de Existencias)
 * en vez de repetir el mismo `.filter()` en los dos. */
export function countExpiringSoon(
  batches: { expiryDate: string | null }[],
  withinDays = 7,
): number {
  return batches.filter((batch) => {
    const days = getDaysUntilExpiry(batch.expiryDate)
    return days !== null && days <= withinDays
  }).length
}
