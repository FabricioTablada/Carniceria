/**
 * lib/categoryColor.ts
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque Final: asigna un color determinístico a
 * una categoría a partir de un hash simple de su `id` — usado como
 * FALLBACK para categorías sin color propio (ver `resolveCategoryColor`
 * mas abajo, Bloque "Color de categoría").
 *
 * Paleta de 5 tonos, todos tokens ya existentes del Design System (ningún
 * color nuevo/hardcodeado): `brand`, `accent-amber`, `accent-teal`,
 * `success`, `destructive`. Con más de 5 categorías activas, varios
 * grupos van a compartir tono — es esperable (mismo criterio que las
 * etiquetas de color de GitHub/Linear): lo que importa es la consistencia
 * por categoría, no la unicidad global.
 *
 * Vive en `lib/` (no en `features/categories/`) porque es explícitamente
 * reutilizable por cualquier módulo del ERP que necesite un color
 * determinístico a partir de un id — `UserAvatar.tsx` tambien lo usa
 * (para iniciales de usuario, sin ninguna relacion con categorías): por
 * eso `getCategoryColor(id)` NO se modifica ni se elimina en este bloque,
 * sigue siendo la funcion generica "id -> uno de 5 tonos".
 */
export interface CategoryColorTokens {
  /** Clase de fondo solido, para el punto de color. */
  dot: string
  /** Clase de texto, mismo tono que `dot`. */
  text: string
  /** Clase de fondo tenue (10% opacidad), para el fondo del badge. */
  tint: string
}

const CATEGORY_COLOR_PALETTE: CategoryColorTokens[] = [
  { dot: 'bg-brand', text: 'text-brand', tint: 'bg-brand/10' },
  { dot: 'bg-accent-amber', text: 'text-accent-amber', tint: 'bg-accent-amber/10' },
  { dot: 'bg-accent-teal', text: 'text-accent-teal', tint: 'bg-accent-teal/10' },
  { dot: 'bg-success', text: 'text-success', tint: 'bg-success/10' },
  { dot: 'bg-destructive', text: 'text-destructive', tint: 'bg-destructive/10' },
]

/** Mismos 5 tonos que `CATEGORY_COLOR_PALETTE`, expresados como variable
 * CSS (`var(--brand)`, etc. — definidas en `src/index.css`, `:root`/
 * `.dark`) en vez de clase Tailwind. Mismo orden exacto: el mismo `id`
 * resuelve al mismo tono conceptual en ambas paletas. Necesario porque
 * `resolveCategoryColor` (mas abajo) tiene que poder mezclar este
 * fallback con un color hexadecimal arbitrario elegido por el usuario en
 * la MISMA propiedad CSS (`style`, no `className`) — Tailwind no puede
 * generar una clase para un hex que no existe en el codigo fuente. */
const CATEGORY_COLOR_VARS = [
  'var(--brand)',
  'var(--accent-amber)',
  'var(--accent-teal)',
  'var(--success)',
  'var(--destructive)',
]

/** Hash simple (djb2-like) — determinístico, sin dependencia externa. */
function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getCategoryColor(categoryId: string): CategoryColorTokens {
  const index = hashString(categoryId) % CATEGORY_COLOR_PALETTE.length
  return CATEGORY_COLOR_PALETTE[index]
}

export interface CategoryColorStyle {
  /** `style` para el punto/icono de color solido. */
  dot: { backgroundColor: string }
  /** `style` para texto en el mismo tono. */
  text: { color: string }
  /** `style` para un fondo tenue (~12%), equivalente al `tint` de
   * `CategoryColorTokens` pero para un color arbitrario. */
  tint: { backgroundColor: string }
}

/**
 * Color de categoría (Bloque "Color de categoría", aprobado): PUNTO UNICO
 * de resolucion de color para cualquier componente del ERP que
 * represente una categoría — reemplaza el uso directo de
 * `getCategoryColor(id)` en los consumidores que ya tienen la categoría
 * completa (o al menos `{id, color}`) disponible.
 *
 * Si la categoría tiene `color` propio (elegido en Crear/Editar
 * Categoría, persistido en `Category.color`, backend), se usa tal cual —
 * en TODO el ERP, sin excepcion (Lista/Árbol/Drawer de Categorías,
 * Crear/Editar Categoría, Lista/Drawer de Productos, Crear/Editar
 * Producto: todos reciben `color` ya en la respuesta de la API que
 * consumen, sin peticion nueva). Si no tiene color propio (`null`/
 * `undefined`, categorias existentes antes de este bloque), cae al mismo
 * color determinístico de siempre (`CATEGORY_COLOR_VARS`, mismo orden
 * que `getCategoryColor` — compatibilidad total, cero cambio visual para
 * categorias sin color explicito).
 *
 * Devuelve `style`, no `className`: un hex elegido en tiempo de
 * ejecucion no puede resolverse a una clase Tailwind (el compilador
 * necesita ver la clase completa en el codigo fuente) — `color-mix()`
 * (soportado en los navegadores evergreen que ya asume el resto del
 * Design System) genera el tono tenue del `tint` para cualquier color de
 * entrada, sea un token del tema (`var(--brand)`, formato oklch) o un hex
 * arbitrario, sin duplicar logica de opacidad para cada caso.
 */
export function resolveCategoryColor(category: {
  id: string
  color?: string | null
}): CategoryColorStyle {
  const base =
    category.color ?? CATEGORY_COLOR_VARS[hashString(category.id) % CATEGORY_COLOR_VARS.length]

  return {
    dot: { backgroundColor: base },
    text: { color: base },
    tint: { backgroundColor: `color-mix(in srgb, ${base} 12%, transparent)` },
  }
}
