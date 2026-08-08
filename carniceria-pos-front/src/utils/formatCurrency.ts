/**
 * utils/formatCurrency.ts
 * -----------------------------------------------------------------------------
 * Formatea un numero como moneda de Costa Rica (CRC), usando el motor de
 * internacionalizacion nativo del navegador (`Intl.NumberFormat`), sin
 * ninguna dependencia externa nueva.
 *
 * Primer archivo de la etapa de "Pulido de UI/UX" del roadmap: hasta ahora,
 * todas las tablas del proyecto (Purchases, Inventory, Reports, Cash,
 * Settings...) muestran los montos como numeros crudos, sin formato de
 * moneda — decision explicita y documentada varias veces durante el
 * desarrollo de esos modulos, pospuesta a proposito para este momento.
 * Este archivo no modifica ninguna tabla existente: es la utilidad
 * compartida que un bloque posterior ira aplicando, tabla por tabla.
 *
 * El formato real (`₡12 345,50`, con coma decimal y espacio como
 * separador de miles) viene directamente de los datos de localizacion
 * `es-CR` de ICU/`Intl` — no es una eleccion arbitraria de este archivo,
 * es el formato real que usa esa configuracion regional.
 */

const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
})

/**
 * Formatea `value` como colones costarricenses (ej. `12345.5` -> `"₡12 345,50"`).
 * Si `value` no es un numero finito (`NaN`, `Infinity`, `undefined` pasado
 * por error en un punto sin chequeo de tipos), devuelve un guion en vez de
 * producir un texto de moneda sin sentido en la interfaz.
 */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  return currencyFormatter.format(value)
}
