// src/features/products/utils/cabysTaxIndicator.ts
/**
 * Mejora UX (indicador visual del impuesto oficial CABYS): replica exacta
 * de `interpretOfficialTaxRate` (backend, `modules/products/cabysTaxCoherence.ts`)
 * — misma interpretacion, mismos mensajes, sin ninguna regla nueva. Es
 * puramente informativa/preventiva: la validacion real que bloquea el
 * guardado sigue viviendo exclusivamente en el backend (`ValidationError`),
 * este archivo nunca decide si un producto se guarda o no.
 */

/**
 * Convierte el valor crudo de `CabysCode.taxIndicator` a puntos
 * porcentuales, o `null` cuando el catalogo oficial no da informacion
 * utilizable (columna vacia, "na", o cualquier formato no reconocido) —
 * mismos casos que el backend.
 */
export function interpretOfficialTaxRate(rawTaxIndicator: string | null | undefined): number | null {
  if (rawTaxIndicator === null || rawTaxIndicator === undefined) {
    return null
  }

  const value = rawTaxIndicator.trim()
  if (value.length === 0) {
    return null
  }

  const normalized = value.toLowerCase()
  if (normalized === 'na') {
    return null
  }
  if (normalized === 'exento') {
    return 0
  }

  const percentMatch = /^(\d+(?:\.\d+)?)%$/.exec(value)
  if (percentMatch) {
    return Number(percentMatch[1])
  }

  const decimalMatch = /^\d+(?:\.\d+)?$/.exec(value)
  if (decimalMatch) {
    return Number(value) * 100
  }

  return null
}

/** Formato legible del impuesto oficial ya interpretado — "Exento" para 0%,
 * "13%" para cualquier otro valor. */
export function formatOfficialTaxRate(officialRate: number): string {
  return officialRate === 0 ? 'Exento' : `${officialRate}%`
}
