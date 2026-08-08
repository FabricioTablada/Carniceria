import { resolveCategoryColor } from '@/lib/categoryColor'
import { cn } from '@/lib/utils'

interface CategoryBadgeProps {
  categoryId: string
  label: string
  /** Color propio de la categoria (`Category.color`/`CategoryLookupItem.color`/
   * `CategorySummary.color`), tal como ya llega en la respuesta de la API
   * que cada consumidor consulta — sin peticion nueva. `null`/`undefined`/
   * prop ausente = sin color propio, cae al mismo color determinístico de
   * siempre (`resolveCategoryColor`, compatibilidad total con categorias
   * sin color explicito). */
  color?: string | null
  className?: string
  /** Pulido visual (aprobado, tabla de Productos): `'tinted'` (default)
   * es el estilo original — fondo y texto teñidos del color de la
   * categoría. `'outline'` es la variante mas limpia/neutra: fondo
   * transparente, borde sutil del tema (`border-border`), texto normal
   * (`text-foreground`) — el color de la categoría queda unicamente en
   * el punto. Aditivo: ningun consumidor existente pasa esta prop, asi
   * que ninguno cambia (`CategoriesTable`/`CategoryDrawer`/
   * `ProductDrawer`/`TaxesTable` siguen viendo `'tinted'`). */
  variant?: 'tinted' | 'outline'
}

/**
 * components/common/CategoryBadge.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque Final: representación visual reutilizable
 * de una categoría (punto de color + nombre). Mismo criterio de "punto de
 * color + texto" que `ActiveStatusBadge.tsx`, con la diferencia de que
 * aquí el fondo también lleva un tinte del mismo tono (~12% opacidad) en
 * vez de un fondo neutro — ayuda a agrupar visualmente productos de la
 * misma categoría al escanear una tabla.
 *
 * Bloque "Color de categoría" (aprobado): color resuelto vía
 * `resolveCategoryColor` (`lib/categoryColor.ts`) — usa el color propio de
 * la categoría (`Category.color`) cuando existe, y cae al mismo color
 * determinístico por `categoryId` de siempre cuando no. Devuelve `style`
 * (no `className`): un hex elegido por el usuario en tiempo real no puede
 * resolverse a una clase Tailwind existente en el código fuente.
 *
 * Vive en `components/common/` (no en `features/products/`) porque no
 * sabe nada de productos — cualquier módulo del ERP que muestre una
 * categoría puede reutilizarlo tal cual.
 *
 * Pulido visual (aprobado, "reducir ruido visual en la tabla de
 * Productos"): variante `'outline'` — sin fondo de color, borde sutil
 * del tema, texto normal; el color de la categoría se conserva
 * únicamente en el punto, como referencia visual liviana.
 */
export function CategoryBadge({
  categoryId,
  label,
  color,
  className,
  variant = 'tinted',
}: CategoryBadgeProps) {
  const resolved = resolveCategoryColor({ id: categoryId, color })

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'outline' && 'border border-border text-foreground',
        className,
      )}
      style={variant === 'outline' ? undefined : { ...resolved.tint, ...resolved.text }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={resolved.dot} />
      <span className="truncate">{label}</span>
    </span>
  )
}
