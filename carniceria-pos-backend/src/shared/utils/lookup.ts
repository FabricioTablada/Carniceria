/**
 * shared/utils/lookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 1: infraestructura para el patron de
 * "lookup" (busqueda acotada para selectores/typeahead), separado del
 * patron de paginacion de tabla completa (`pagination.ts`).
 *
 * Diferencias deliberadas frente a `resolvePagination`/`buildPaginationMeta`:
 *  - Sin `skip`/`page`/`total`/`totalPages`/`hasNext`/`hasPrev`: un lookup
 *    no es una tabla navegable pagina por pagina, es una busqueda acotada a
 *    los N mejores resultados del termino actual. Calcular el `total` real
 *    obligaria a repetir el mismo filtro una segunda vez (el mismo costo de
 *    `count()` ya senalado como problema de escalabilidad en el analisis
 *    aprobado) para un dato que un selector no necesita mostrar.
 *  - `LOOKUP_DEFAULT_LIMIT`/`LOOKUP_MAX_LIMIT` son deliberadamente mas bajos
 *    que los de tabla (`DEFAULT_LIMIT=20`/`MAX_LIMIT=100` en
 *    `pagination.ts`): el patron de lookup asume busqueda por termino (el
 *    usuario escribe, el backend filtra con indice de trigramas), no
 *    "traer todo el catalogo en una sola respuesta". Subir este limite no
 *    es la solucion a "selector incompleto" — filtrar con un termino de
 *    busqueda mas especifico si lo es (ver analisis aprobado, causa raiz A).
 */
export interface LookupParams {
  take: number;
}

const LOOKUP_DEFAULT_LIMIT = 20;
const LOOKUP_MAX_LIMIT = 50;

export function resolveLookupParams(query: { limit?: unknown }): LookupParams {
  const rawLimit = Number(query.limit) || LOOKUP_DEFAULT_LIMIT;
  const take = Math.min(LOOKUP_MAX_LIMIT, Math.max(1, rawLimit));
  return { take };
}

/**
 * Forma liviana de un item de selector: exactamente lo que un dropdown
 * necesita para mostrar una opcion y devolver un id al seleccionarla —
 * nunca el recurso completo con sus relaciones incluidas (ver analisis
 * aprobado, causa raiz E: cada picker pagaba el costo de serializar
 * `category`+`tax`/`parent`/`role` por fila, aunque solo mostrara un
 * nombre).
 */
export interface LookupItem {
  id: string;
  label: string;
}
