/**
 * modules/products/cabysTaxCoherence.ts
 * -----------------------------------------------------------------------------
 * Validacion CABYS <-> Impuesto (Bloque de validacion, posterior al bloque
 * de extension de importacion que agrego `CabysCode.taxIndicator`).
 *
 * Usa EXCLUSIVAMENTE el valor oficial ya almacenado en `CabysCode.taxIndicator`
 * (importado tal cual desde el catalogo del BCCR, ver `prisma/import-cabys.ts`)
 * — ninguna tarifa esta hardcodeada aqui, ninguna regla fiscal se inventa.
 *
 * Interpretacion de `taxIndicator` (evidencia real, abriendo el `.xlsx`
 * oficial completo — 20 507 filas de datos, columna "Impuesto"):
 *   - Numero decimal fraccionario (0.01, 0.02, 0.04, 0.13): 810 / 4878 /
 *     4618 / 9259 filas respectivamente. `Tax.rate` en este ERP se guarda
 *     en PUNTOS PORCENTUALES (ver comentario de `Tax.rate` en
 *     `schema.prisma`: "porcentaje, ej. 13.00"), asi que `valor * 100` los
 *     lleva al mismo punto porcentual: 0.01->1, 0.02->2, 0.04->4, 0.13->13.
 *   - Texto con sufijo "%" ("1%": 21 filas, "13%": 32 filas): representan
 *     el MISMO concepto que su equivalente decimal (1% == 0.01, 13% ==
 *     0.13) — el propio archivo oficial usa ambas notaciones para la misma
 *     tarifa segun la fila, sin ninguna diferencia de significado; se leen
 *     como el numero antes del "%", ya en puntos porcentuales.
 *   - "Exento" (885 filas): tarifa 0% — corresponde al mismo concepto que
 *     la tasa `EXENTO`/`rate: 0` ya usada en este ERP (`prisma/seed.ts`).
 *   - "na" (3 filas): el propio catalogo oficial declara que NO aplica
 *     ninguna tarifa a ese codigo — se trata como "sin informacion", igual
 *     que un valor vacio o `null` (columna ausente, ej. import via CSV
 *     simple, o codigo no presente en el catalogo importado).
 *   - Cualquier otro valor no observado en el catalogo real: se trata como
 *     "sin informacion" en vez de inventar una interpretacion sin
 *     evidencia — nunca bloquea un guardado por una lectura no verificada.
 */
import { ValidationError } from '@/shared/errors';

/**
 * Convierte el valor crudo de `CabysCode.taxIndicator` a puntos
 * porcentuales, o `null` cuando el catalogo oficial no da informacion
 * utilizable (columna vacia, "na", o cualquier formato no reconocido en el
 * catalogo real — ver justificacion arriba).
 */
export function interpretOfficialTaxRate(rawTaxIndicator: string | null): number | null {
  if (rawTaxIndicator === null) {
    return null;
  }

  const value = rawTaxIndicator.trim();
  if (value.length === 0) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'na') {
    return null;
  }
  if (normalized === 'exento') {
    return 0;
  }

  const percentMatch = /^(\d+(?:\.\d+)?)%$/.exec(value);
  if (percentMatch) {
    return Number(percentMatch[1]);
  }

  const decimalMatch = /^\d+(?:\.\d+)?$/.exec(value);
  if (decimalMatch) {
    return Number(value) * 100;
  }

  return null;
}

/**
 * Bloquea el guardado (creacion o edicion) de un producto solo cuando el
 * catalogo oficial SI tiene informacion utilizable para el CABYS elegido Y
 * esa informacion no coincide con el impuesto seleccionado. En cualquier
 * otro caso (sin informacion oficial, codigo no encontrado en el catalogo
 * importado, o coincidencia) guarda normalmente — nunca bloquea por falta
 * de dato, solo por una incoherencia confirmada.
 */
export function assertCabysTaxCoherence(params: {
  cabysCode: string;
  officialTaxIndicator: string | null | undefined;
  selectedTax: { rate: number; name: string };
}): void {
  const officialRate = interpretOfficialTaxRate(params.officialTaxIndicator ?? null);

  if (officialRate === null) {
    return;
  }

  if (officialRate !== params.selectedTax.rate) {
    throw new ValidationError(
      `El impuesto seleccionado ("${params.selectedTax.name}", ${params.selectedTax.rate}%) no coincide con ` +
        `el impuesto oficial del codigo CABYS ${params.cabysCode} segun el catalogo del BCCR (${officialRate}%). ` +
        `Corrija el impuesto del producto o verifique el codigo CABYS.`,
    );
  }
}
