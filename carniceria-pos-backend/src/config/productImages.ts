/**
 * config/productImages.ts
 * -----------------------------------------------------------------------------
 * Punto unico de la infraestructura de imagenes de productos (bloque
 * "Imagenes 1"). Hoy: el backend sirve los archivos desde un directorio
 * local (`PRODUCT_IMAGES_STORAGE_DIR`) bajo un prefijo dedicado
 * (`PRODUCT_IMAGES_URL_PREFIX`), fuera de `API_PREFIX` — no es parte del
 * contrato JSON versionado, es un recurso estatico.
 *
 * Manana: migrar el almacenamiento fisico a un servicio de objetos
 * (S3/Cloudflare R2/CDN) solo requiere cambiar `buildProductImageUrl()`
 * (y retirar el middleware `express.static` de `app.ts`) — ningun
 * consumidor de `Product.imageUrl` (seeds, `products.service.ts`,
 * cualquier frontend presente o futuro) necesita cambiar una sola linea,
 * porque siempre reciben una URL absoluta ya resuelta por el backend.
 */
import path from 'node:path';
import { env } from './env';

export const PRODUCT_IMAGES_URL_PREFIX = '/product-images';

export const PRODUCT_IMAGES_STORAGE_DIR = path.resolve(
  process.cwd(),
  env.PRODUCT_IMAGES_STORAGE_DIR,
);

/**
 * Politica de cache HTTP para las imagenes de productos (bloque "Imagenes
 * 3"). Es un valor de configuracion puro (una duracion), completamente
 * desacoplado del modelo de datos y del origen fisico del archivo —
 * aplica igual si el archivo lo sirve `express.static` hoy o un bucket de
 * objetos/CDN mañana (todos entienden `Cache-Control`).
 *
 * `1d` (no `immutable`, no un año): estas imagenes se reemplazan de vez en
 * cuando manteniendo el MISMO nombre de archivo (ver Bloque "Imagenes 2",
 * donde 4 categorias se corrigieron sin cambiar la URL) — un `max-age`
 * moderado reduce peticiones repetidas en el uso normal del catalogo del
 * POS sin arriesgar que un reemplazo de imagen quede invisible por mucho
 * tiempo. `ETag`/`Last-Modified` (ya activos por defecto en
 * `express.static`) siguen siendo la red de seguridad: en cuanto vence la
 * ventana de frescura, el navegador revalida y detecta el cambio de
 * inmediato, sin re-descargar el archivo completo si no cambio.
 */
export const PRODUCT_IMAGES_CACHE_MAX_AGE = '1d';

/**
 * Unica funcion que sabe como convertir "el nombre de archivo de una imagen
 * de producto" en la URL absoluta que termina almacenada en
 * `Product.imageUrl`. Es el unico punto que cambiaria al migrar el
 * almacenamiento fisico a un proveedor externo — todo lo demas (modelo de
 * datos, servicio de productos, frontend) sigue igual porque solo conoce el
 * valor ya resuelto, nunca de donde viene.
 */
export function buildProductImageUrl(filename: string): string {
  return `${env.PRODUCT_IMAGES_BASE_URL}${PRODUCT_IMAGES_URL_PREFIX}/${filename}`;
}

/**
 * Agrega el parametro de cache-busting (`?v=<updatedAt>`) a una URL de
 * imagen ya resuelta (Bloque 10). El nombre de archivo de una imagen de
 * producto es SIEMPRE el mismo (`<productId>.<ext>`, ver
 * `productImageStorage.ts`) — al reemplazarla, la URL no cambia, asi que
 * sin este parametro el navegador seguiria mostrando la version cacheada
 * (`PRODUCT_IMAGES_CACHE_MAX_AGE`, arriba) hasta que venza. `version` es
 * `product.updatedAt` en milisegundos: cualquier escritura del producto lo
 * actualiza, asi que despues de subir/reemplazar/eliminar una imagen el
 * valor cambia y el navegador pide el archivo de nuevo. NO se guarda en
 * `Product.imageUrl` — se agrega solo al serializar la respuesta, para que
 * la columna siga guardando la URL base "limpia".
 */
export function withImageCacheBusting(imageUrl: string, version: Date): string {
  return `${imageUrl}?v=${version.getTime()}`;
}

/** Tipos MIME aceptados para imagenes de producto (Bloque 10) — whitelist
 * explicita por mimetype real (lo que detecta multer del `Content-Type`
 * de cada parte), no por extension del nombre de archivo original. */
export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];

const MIME_TYPE_TO_EXTENSION: Record<ProductImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** `null` si el mimetype no esta en la whitelist — quien llama decide que
 * hacer (hoy, `productImageStorage.ts` lo trata como error de validacion). */
export function extensionForMimeType(mimeType: string): string | null {
  return MIME_TYPE_TO_EXTENSION[mimeType as ProductImageMimeType] ?? null;
}

/** Tamaño maximo aceptado por archivo, en bytes — unica fuente de verdad
 * (deriva de `PRODUCT_IMAGE_MAX_SIZE_MB`), usada tanto por el limite de
 * `multer` como por cualquier mensaje de validacion que necesite mostrar
 * el valor. */
export const PRODUCT_IMAGE_MAX_SIZE_MB = env.PRODUCT_IMAGE_MAX_SIZE_MB;
export const PRODUCT_IMAGE_MAX_SIZE_BYTES = PRODUCT_IMAGE_MAX_SIZE_MB * 1024 * 1024;
