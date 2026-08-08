import type { ReactNode } from 'react'
import { Plus, Star } from 'lucide-react'
import { Card } from './card'
import { ProductThumbnail } from './ProductThumbnail'
import { cn } from '@/lib/utils'

interface MediaCardProps {
  imageUrl?: string | null
  title: string
  /** Identificador corto (ej. SKU), mostrado en mono debajo del titulo —
   * mismo tratamiento que `PurchaseItemRow.tsx`/`CartItems.tsx` para
   * identificadores de producto. Opcional, no todos los consumidores
   * tienen uno. */
  sku?: string | null
  caption?: string
  /** Bloque POS-02: variante de `caption` para un indicador con color
   * propio (ej. `StockStatusBadge`) — se renderiza tal cual, SIN el chip
   * neutro (`bg-muted`) que sí envuelve a `caption` (ese chip pisaria el
   * color que el indicador ya trae). Mutuamente excluyente con `caption`:
   * si se pasan ambos, `stockBadge` gana. */
  stockBadge?: ReactNode
  price?: string
  actionLabel?: string
  onAction?: () => void
  onClick?: () => void
  className?: string
  /** Rediseño del POS (aprobado, "catálogo inteligente"): rótulo corto en
   * la esquina de la imagen (ej. "2x1", "Top", "Stock bajo") — aditivo,
   * `undefined` por defecto, no cambia nada para consumidores que no lo
   * pasan. Presentación pura: quien use `MediaCard` decide el texto/color
   * vía `cornerBadgeTone`. */
  cornerBadge?: string
  cornerBadgeTone?: 'brand' | 'success' | 'warning'
  /** Marca "favorito" — estrella tocable en la esquina superior derecha de
   * la imagen. Aditivo: sin `onToggleFavorite`, no se renderiza nada
   * nuevo. Preferencia puramente de UI (ver `useFavoriteProducts.ts`), no
   * un dato de negocio. */
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

/**
 * components/ui/MediaCard.tsx
 * -----------------------------------------------------------------------------
 * Consumidores: `ProductCatalogCard.tsx` (catálogo del POS) y, vía
 * `ProductThumbnail` compartido (Bloque "Imágenes 4"), la misma estrategia
 * visual de imagen/fallback la reutiliza `CartItems.tsx` (línea del
 * carrito) — mismo comportamiento en ambos lugares, sin lógica duplicada.
 * Rediseño final del POS (aprobado): precio y unidad ya no comparten una
 * misma fila — competian por el mismo ancho y el precio terminaba
 * truncado ("₡1000... / u..."). Ahora es una pila vertical (Precio →
 * Unidad → Boton), cada uno en su propia linea, sin `truncate` en el
 * precio — nunca se recorta, la tarjeta se dimensiona para que quepa
 * completo. Mas aire entre bloques (`gap-2.5` en vez de `gap-1`). Mismas
 * props, mismo contrato (`onAction`/`onClick`), sin logica nueva.
 *
 * Pulido visual (aprobado): `sku` opcional y aditivo (nuevo, en mono bajo
 * el titulo) — `caption` (stock) pasa de texto suelto a un chip
 * (`bg-muted`), mismo lenguaje que el resto del sistema para datos
 * secundarios de una tarjeta. Padding interno `p-2.5` -> `p-3` y borde
 * sutil que se tiñe de marca en hover (antes solo la sombra cambiaba) —
 * mismo radio/sombra que ya tenia (`rounded-xl`/`shadow-sm`, iguales a
 * `Card` en Productos), ahora con un poco mas de jerarquia entre bloques.
 *
 * Pulido de catalogo (aprobado): la grilla del POS paso de hasta 7
 * columnas a ~5 (`ProductResults.tsx`) — cada tarjeta gana ancho, asi que
 * el nombre sube de `text-xs` a `text-sm` (mejor lectura a la distancia
 * del mostrador) y el precio de `text-base` a `text-lg`. Mismo layout,
 * sin cambios de props.
 *
 * Pulido de densidad (aprobado, Bloque 6 — unico consumidor real
 * verificado: `ProductCatalogCard.tsx`, catalogo del POS): el boton
 * "Agregar" ocupaba una fila propia de texto completo debajo del precio.
 * Ahora comparte fila con el precio (precio a la izquierda, boton
 * cuadrado de solo icono a la derecha) — recupera una fila completa de
 * alto por tarjeta sin perder claridad: `aria-label` sigue siendo
 * "Agregar {nombre del producto}" (sin cambios en `ProductCatalogCard.tsx`),
 * y el objetivo tactil se mantiene en `size-9` (36px, dentro del rango
 * recomendado 36-40px para POS tactil) — ademas, la tarjeta ENTERA ya
 * dispara el mismo `onSelect` via `onClick` (verificado en
 * `ProductCatalogCard.tsx`: `onClick` y `onAction` llaman al mismo
 * handler), asi que este boton nunca fue el unico camino para agregar,
 * es un affordance visual complementario. Proporcion de imagen
 * `aspect-video` (16:9) -> `aspect-[4/3]` (mas cuadrada, igual que la
 * maqueta ERP aprobada, menos aire vacio alrededor del nombre/precio).
 *
 * Pulido de precio (aprobado, Bloque 8): el precio dominaba demasiado la
 * tarjeta (`text-lg font-extrabold text-brand`, el elemento tipografico
 * mas pesado de toda la tarjeta, compitiendo con el nombre). Pasa a
 * `text-base font-semibold text-foreground` — color de texto normal (no
 * el rojo/terracota de marca), peso semibold en vez de extrabold, un
 * escalon mas chico — acompaña la tarjeta como un dato mas, en vez de
 * dominarla. Mismo string ya formateado (`formatCurrency`, sin cambios en
 * `ProductCatalogCard.tsx`), solo cambia la presentacion.
 *
 * Pulido visual (aprobado, "software comercial profesional"): sombra/
 * borde con mas presencia (`shadow-sm` -> sombra propia mas suave y
 * amplia; `border-transparent` -> borde solido tenue, distinguible del
 * fondo del catalogo incluso sin hover) y mejor jerarquia entre bloques
 * (nombre gana un punto de tamaño; precio pasa a `font-bold` para
 * distinguirse claramente de nombre/SKU/stock sin volver a competir con
 * el nombre). Boton "+" mas premium: `rounded-lg` -> `rounded-xl`,
 * sombra tintada de marca y leve escala en hover. Mismas props, mismo
 * contrato, cero cambio de comportamiento.
 */
const CORNER_BADGE_TONE_CLASSNAMES: Record<NonNullable<MediaCardProps['cornerBadgeTone']>, string> = {
  brand: 'bg-brand text-brand-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-accent-amber text-accent-amber-foreground',
}

export function MediaCard({
  imageUrl,
  title,
  sku,
  caption,
  stockBadge,
  price,
  actionLabel,
  onAction,
  onClick,
  className,
  cornerBadge,
  cornerBadgeTone = 'brand',
  isFavorite,
  onToggleFavorite,
}: MediaCardProps) {
  return (
    <Card
      className={cn(
        'group touch-manipulation gap-0 overflow-hidden rounded-xl border border-foreground/[0.06] p-0 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-14px_rgba(0,0,0,0.12)] transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-14px_rgba(0,0,0,0.18)] active:scale-[0.98]',
        className,
      )}
      onClick={onClick}
    >
      {/* Rediseño del POS (aprobado, "la prioridad visual debe ser
          nombre/precio/stock/botón, no la imagen"): `aspect-[4/3]` ->
          `aspect-[2/1]` — imagen más baja, cede ese alto a la información
          que realmente decide una venta.
          Incidencia 2 (07/08/2026): `imageFit="contain"` evita el recorte
          agresivo en imágenes que no calzan exacto con `aspect-[2/1]`
          (legacy, previas al editor de recorte del Bloque 10.1) — único
          consumidor real de `contain` en `ProductThumbnail`, el resto
          sigue en `cover` (default) sin cambios. */}
      <div className="relative">
        <ProductThumbnail
          imageUrl={imageUrl}
          title={title}
          containerClassName="aspect-[2/1]"
          textClassName="text-2xl text-brand/35"
          imageFit="contain"
        />
        {cornerBadge && (
          <span
            className={cn(
              'absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide uppercase shadow-sm',
              CORNER_BADGE_TONE_CLASSNAMES[cornerBadgeTone],
            )}
          >
            {cornerBadge}
          </span>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorite ? `Quitar ${title} de favoritos` : `Agregar ${title} a favoritos`}
            aria-pressed={isFavorite}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite()
            }}
            className={cn(
              'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full shadow-sm transition-colors',
              isFavorite
                ? 'bg-accent-amber text-accent-amber-foreground'
                : 'bg-background/80 text-muted-foreground hover:text-accent-amber',
            )}
          >
            <Star className="size-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="line-clamp-2 min-h-9 text-[0.9375rem] leading-snug font-semibold tracking-tight">
            {title}
          </span>
          {sku && (
            <span className="truncate font-mono text-[0.625rem] text-muted-foreground/80">
              {sku}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {stockBadge ? (
            <div className="text-[0.6875rem]">{stockBadge}</div>
          ) : (
            caption && (
              <span className="inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] leading-tight font-semibold text-muted-foreground">
                {caption}
              </span>
            )
          )}

          <div className="flex items-center justify-between gap-2">
            {price && (
              <span className="truncate text-base leading-tight font-bold tracking-tight text-foreground tabular-nums">
                {price}
              </span>
            )}

            {actionLabel && onAction && (
              <button
                type="button"
                aria-label={actionLabel}
                onClick={(event) => {
                  event.stopPropagation()
                  onAction()
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-[0_6px_14px_-6px_var(--brand)] transition-all duration-150 hover:scale-105 hover:bg-brand-hover active:scale-95 active:bg-brand-active"
              >
                <Plus className="size-4.5" strokeWidth={2.75} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
