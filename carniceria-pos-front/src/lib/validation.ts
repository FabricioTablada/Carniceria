/**
 * lib/validation.ts
 * -----------------------------------------------------------------------------
 * Utilidad compartida de validacion de identificadores, usada por todos los
 * `schemas/*.schema.ts` del proyecto en lugar del `.uuid()` nativo de Zod.
 *
 * CAUSA RAIZ (QA critico, registro de mermas): el proyecto usa Zod v4 en el
 * frontend y Zod v3 en el backend (`package.json` de cada repo). `.uuid()`
 * de Zod v4 exige un UUID RFC 4122 estricto (nibble de version 1-8, nibble
 * de variante 8/9/a/b) — Zod v3 (backend) usa una forma mas permisiva, solo
 * el patron hexadecimal 8-4-4-4-12. `env.SUCURSAL_ID` (sembrado en
 * `prisma/seed.ts` del backend como `00000000-0000-0000-0000-000000000001`,
 * deliberadamente legible, no aleatorio) es un UUID valido para Postgres y
 * para el backend, pero NO cumple el formato estricto de Zod v4 — cualquier
 * schema del frontend que lo validara con `.uuid()` lo rechazaba en
 * silencio, sin que la peticion HTTP llegara siquiera a salir.
 *
 * `UUID_REGEX` replica exactamente el patron que el backend (Zod v3) ya
 * acepta — no relaja la validacion mas de lo necesario (sigue exigiendo
 * forma hexadecimal 8-4-4-4-12 con guiones), solo elimina la restriccion
 * de version/variante que Zod v4 agrega y que el backend nunca exigio.
 */
import { z } from 'zod'

export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Reemplazo directo de `z.string().uuid(message)` — misma forma
 * encadenable (`ZodString`, soporta `.min()`, `.optional()`, `.nullish()`,
 * etc. despues), pero validando contra `UUID_REGEX` en vez del `.uuid()`
 * nativo de Zod v4.
 */
export function uuidField(message = 'Debe ser un identificador válido.') {
  return z.string().regex(UUID_REGEX, message)
}
