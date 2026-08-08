import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ProductThumbnailProps {
  imageUrl?: string | null
  title: string
  /** Clases del contenedor: tamaño/forma (ej. `aspect-video` en el
   * catálogo, `size-11 shrink-0 rounded-xl` en el carrito). */
  containerClassName?: string
  /** Clases del texto de la inicial cuando no hay imagen: tamaño/color
   * (ej. `text-3xl text-brand/35` en el catálogo, `text-lg text-brand/45`
   * en el carrito). */
  textClassName?: string
  /** Incidencia 2 (07/08/2026): `object-fit` de la imagen — aditivo,
   * `'cover'` por defecto (comportamiento exacto de siempre, sin cambios
   * para ningún consumidor existente). `'contain'` evita cualquier
   * recorte, a costa de dejar ver el fondo cuando la imagen no calza
   * exacto con el contenedor — por eso NO es el default: en contenedores
   * `rounded-full` (`ProductSearchDialog.tsx`/`PurchaseItemCard.tsx`) se
   * vería roto (cuñas del fondo fuera del rectángulo inscripto en el
   * círculo). Único consumidor real de `'contain'`: `MediaCard.tsx`
   * (catálogo POS, `aspect-[2/1]`), ver su propio comentario. */
  imageFit?: 'cover' | 'contain'
}

function getInitial(title: string): string {
  const trimmed = title.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

/**
 * components/ui/ProductThumbnail.tsx
 * -----------------------------------------------------------------------------
 * Bloque "Imágenes 4": única estrategia visual de "imagen de producto con
 * fallback" del proyecto — extraída de `MediaCard.tsx` para que
 * `CartItems.tsx` (línea del carrito) deje de duplicar su propia lógica de
 * inicial/fallback y use exactamente el mismo comportamiento que el
 * catálogo: `<img>` si `imageUrl` existe y no falló al cargar; si no, la
 * inicial del nombre sobre el mismo fondo de marca. `imageFailed` se
 * reinicia cuando `imageUrl` cambia (comparación con el valor anterior
 * durante el render, sin `useEffect`) para no arrastrar el fallo de una
 * imagen anterior a un producto distinto (ej. una tarjeta reciclada en el
 * mismo puesto del grid, o una línea de carrito que cambia de producto).
 *
 * Tamaño/forma del contenedor y tamaño/color del texto de la inicial se
 * parametrizan por className — el único consumidor que decide cómo se ve
 * "grande" (tarjeta del catálogo) o "compacto" (miniatura del carrito) es
 * quien lo usa, no este componente.
 */
export function ProductThumbnail({
  imageUrl,
  title,
  containerClassName,
  textClassName,
  imageFit = 'cover',
}: ProductThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [previousImageUrl, setPreviousImageUrl] = useState(imageUrl)
  if (imageUrl !== previousImageUrl) {
    setPreviousImageUrl(imageUrl)
    setImageFailed(false)
  }
  const showImage = Boolean(imageUrl) && !imageFailed

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand/[0.18] via-brand/[0.08] to-transparent',
        containerClassName,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={title}
          className={cn('size-full', imageFit === 'contain' ? 'object-contain' : 'object-cover')}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={cn('font-extrabold select-none', textClassName)}>
          {getInitial(title)}
        </span>
      )}
    </div>
  )
}
