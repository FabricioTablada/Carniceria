/**
 * modules/products/productImageStorage.ts
 * -----------------------------------------------------------------------------
 * Escritura/borrado fisico de archivos de imagen de producto en disco
 * (Bloque 10 — gestion completa de imagenes). Nombrado deterministico por
 * producto (`<productId>.<ext>`): reemplazar una imagen es sobrescribir el
 * mismo nombre — no genera huerfanos, no requiere guardar el nombre de
 * archivo en la base de datos (`Product.imageUrl` sigue siendo solo la URL
 * resuelta). `withImageCacheBusting` (config/productImages.ts) resuelve la
 * invalidacion de cache del navegador ante un reemplazo sin cambiar esa URL.
 *
 * Unico caso que SI podria dejar un huerfano sin ayuda: si el producto
 * cambia de extension entre una subida y la siguiente (ej. reemplaza un
 * .jpg por un .png) — `saveProductImage` borra explicitamente cualquier
 * archivo previo del mismo `productId` con OTRA extension antes de escribir
 * el nuevo, cubriendo ese caso.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PRODUCT_IMAGES_STORAGE_DIR, buildProductImageUrl, extensionForMimeType } from '@/config';
import { ValidationError } from '@/shared/errors';
import { matchesImageSignature } from '@/shared/utils/imageSignature';

/** Debe reflejar exactamente las claves de `MIME_TYPE_TO_EXTENSION`
 * (config/productImages.ts) — es la lista de extensiones que un producto
 * PODRIA tener guardadas, usada para localizar/borrar el archivo previo
 * sin necesidad de conocer su mimetype original. */
const KNOWN_EXTENSIONS = ['jpg', 'png', 'webp'];

async function removeExistingVariants(productId: string, keepExtension?: string): Promise<void> {
  await Promise.all(
    KNOWN_EXTENSIONS.filter((extension) => extension !== keepExtension).map((extension) =>
      fs.rm(path.join(PRODUCT_IMAGES_STORAGE_DIR, `${productId}.${extension}`), { force: true }),
    ),
  );
}

/**
 * Guarda el buffer del archivo subido como `<productId>.<ext>` (extension
 * derivada del mimetype REAL detectado por multer, no del nombre de
 * archivo original) y devuelve la URL base (sin cache-busting) para
 * guardar en `Product.imageUrl`. Si el producto ya tenia una imagen con
 * OTRA extension, la borra primero — nunca quedan dos archivos para el
 * mismo producto.
 */
export async function saveProductImage(params: {
  productId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const extension = extensionForMimeType(params.mimeType);

  if (!extension) {
    // Defensivo: el `fileFilter` de multer (products.routes.ts) ya rechaza
    // mimetypes fuera de la whitelist antes de llegar aca.
    throw new ValidationError('Tipo de imagen no soportado.');
  }

  // Hallazgo de seguridad #7 (auditoria 31/07/2026): el `fileFilter` de
  // multer solo valida el `Content-Type` DECLARADO por el cliente — un
  // archivo cualquiera con ese header falsificado pasaba sin problema. Aca
  // ya se tiene el buffer completo, asi que se verifica que sus primeros
  // bytes correspondan de verdad al mimetype declarado antes de guardarlo.
  if (!matchesImageSignature(params.buffer, params.mimeType)) {
    throw new ValidationError(
      'El archivo no es una imagen valida del tipo declarado.',
    );
  }

  await fs.mkdir(PRODUCT_IMAGES_STORAGE_DIR, { recursive: true });
  await removeExistingVariants(params.productId, extension);

  const filename = `${params.productId}.${extension}`;
  await fs.writeFile(path.join(PRODUCT_IMAGES_STORAGE_DIR, filename), params.buffer);

  return buildProductImageUrl(filename);
}

/** Borra cualquier archivo de imagen existente para el producto, sin
 * importar la extension — usado al eliminar la imagen
 * (`DELETE /products/:id/image`). No falla si no existe ningun archivo. */
export async function deleteProductImage(productId: string): Promise<void> {
  await removeExistingVariants(productId);
}
