/**
 * features/products/utils/productImageValidation.ts
 * -----------------------------------------------------------------------------
 * Bloque 10 (gestion de imagenes): replica a mano las mismas reglas que el
 * backend aplica en `productImage.middleware.ts`/`config/productImages.ts`
 * (mismo criterio ya documentado para `schemas/product.schema.ts` —
 * duplicacion intencional, se mantiene sincronizada a mano si cambian).
 * Valida ANTES de intentar la subida, para dar feedback inmediato sin
 * esperar un viaje de red que el backend va a rechazar de todas formas.
 */

/** Debe coincidir con `PRODUCT_IMAGE_MAX_SIZE_MB` (backend, `env.ts`). */
export const PRODUCT_IMAGE_MAX_SIZE_MB = 5

export const PRODUCT_IMAGE_MAX_SIZE_BYTES = PRODUCT_IMAGE_MAX_SIZE_MB * 1024 * 1024

/** Debe coincidir con `PRODUCT_IMAGE_ALLOWED_MIME_TYPES` (backend,
 * `config/productImages.ts`). */
export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const PRODUCT_IMAGE_ALLOWED_FORMATS_LABEL = 'JPG, PNG o WEBP'

/** Bloque 10.1 (editor de imagenes): misma relacion que `MediaCard.tsx`
 * usa para la miniatura del catalogo (`aspect-[2/1]`) — el recorte se
 * fuerza a esta proporcion ANTES de subir, asi `ProductThumbnail.tsx`
 * (`object-cover`) nunca vuelve a recortar por su cuenta.
 *
 * Version 1.0.3, Bloque 5: reajustado de `4/3` a `2/1` — quedo
 * desactualizado tras un rediseno posterior del catalogo del POS
 * (`aspect-video` -> `aspect-[4/3]` -> `aspect-[2/1]`, ver comentarios de
 * `MediaCard.tsx`) que nunca actualizo esta constante. El desajuste hacia
 * que el recorte "perfecto" del cajero en el editor (4:3) se recortara de
 * nuevo, sin control, al mostrarse en el catalogo real (2:1). Decision de
 * producto confirmada con una comparacion visual real: el catalogo se
 * mantiene en 2:1 (no se reabre esa decision), el editor se realinea a
 * ese valor. */
export const PRODUCT_IMAGE_ASPECT_RATIO = 2 / 1

/** `null` si el archivo es valido — mensaje legible en caso contrario. */
export function validateProductImageFile(file: File): string | null {
  if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number])) {
    return `Formato no soportado. Usa ${PRODUCT_IMAGE_ALLOWED_FORMATS_LABEL}.`
  }

  if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
    return `El archivo supera el tamaño máximo permitido (${PRODUCT_IMAGE_MAX_SIZE_MB}MB).`
  }

  return null
}
