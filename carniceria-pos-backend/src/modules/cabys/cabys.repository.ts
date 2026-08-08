/**
 * modules/cabys/cabys.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos del catalogo `CabysCode`. Infraestructura pura, solo
 * lectura — el catalogo se carga exclusivamente por
 * `prisma/import-cabys.ts` (Bloque 1), nunca desde este repositorio.
 *
 * Version 1.1, Bloque 3 (ranking del buscador): el filtro (que codigos
 * aparecen) y el orden (en que secuencia aparecen) son dos preguntas
 * independientes — nunca se oculta un resultado que antes aparecia, solo
 * se reordena. El filtro sigue siendo el mismo `OR` de siempre (prefijo
 * de codigo o subcadena de descripcion, via el indice de trigramas GIN
 * del Bloque 1). El orden ahora usa Full Text Search nativo de
 * PostgreSQL (`orderBy: { _relevance: ... }`, expuesto por el preview
 * feature `fullTextSearchPostgres` de Prisma — sin `$queryRaw`, ver
 * justificacion en `schema.prisma`): tokeniza la descripcion en
 * lexemas/palabras reales, asi que "pollo" nunca puntua por una
 * coincidencia dentro de "repollo" (son lexemas distintos) — a
 * diferencia de la subcadena simple, que si los confundia. Sin
 * diccionario de palabras de ningun rubro: es el motor de busqueda de
 * texto generico de PostgreSQL, igual de util para cualquier negocio.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { LookupCabysFilters } from './cabys.types';

/**
 * Convierte un termino de busqueda libre en una expresion tsquery válida
 * de PostgreSQL: separa por palabras, descarta cualquier caracter que
 * no sea letra/digito (evita que un usuario escriba un operador de
 * tsquery como `&`/`|`/`:` y rompa la consulta o cambie su significado),
 * y une las palabras completas con `&` (todas deben aparecer). La
 * ULTIMA palabra se trata como prefijo (`:*`) — el usuario todavia puede
 * estar escribiendola letra por letra (busqueda en vivo, mismo criterio
 * que el resto del proyecto con debounce de 300ms), las palabras
 * anteriores ya estan completas. Devuelve `null` si no queda ninguna
 * palabra utilizable (ej. el usuario borro todo o escribio solo
 * simbolos) — en ese caso no se aplica ranking alguno.
 */
function buildTsQuery(rawSearch: string): string | null {
  const words = rawSearch
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return null;
  }

  return words
    .map((word, index) => (index === words.length - 1 ? `${word}:*` : word))
    .join(' & ');
}

/**
 * Busqueda acotada por codigo (prefijo) o descripcion (indice de
 * trigramas GIN, mismo criterio que `products.repository.ts::lookup`
 * sobre `name`/`sku`). Solo codigos activos — un codigo retirado no debe
 * ofrecerse para un producto nuevo, aunque productos existentes puedan
 * seguir referenciandolo.
 */
export function lookup(params: { take: number; filters?: LookupCabysFilters }) {
  const search = params.filters?.search;

  const where: Prisma.CabysCodeWhereInput = {
    active: true,
    ...(search && {
      OR: [
        { code: { startsWith: search } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const tsQuery = search ? buildTsQuery(search) : null;

  return prisma.cabysCode.findMany({
    where,
    // Mejora UX (indicador visual del impuesto oficial en ProductForm.tsx):
    // se agrega `taxIndicator` al select — mismo campo ya usado por la
    // validacion CABYS<->Impuesto (`cabysTaxCoherence.ts`), solo lectura,
    // no cambia el filtro (`where`), el orden (`orderBy`) ni la paginacion
    // (`take`) de abajo.
    select: { code: true, description: true, taxIndicator: true },
    take: params.take,
    orderBy: tsQuery
      ? [{ _relevance: { fields: ['description'], search: tsQuery, sort: 'desc' } }, { code: 'asc' }]
      : { code: 'asc' },
  });
}
